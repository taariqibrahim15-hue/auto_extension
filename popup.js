const fields = [
  "fromDestination",
  "toDestination",
  "travelDate"
];

let statusEl;
let passengerListEl;
let seatToggle;

// ================= STATUS =================
function showStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff6b6b" : "#22c55e";
}

// ================= GET PASSENGERS =================
async function loadPassengersFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) return;

  chrome.tabs.sendMessage(
    tab.id,
    { action: "GET_PASSENGERS" },
    (response) => {
      if (chrome.runtime.lastError) {
        showStatus("Open booking page first", true);
        return;
      }

      if (!response || !response.passengers?.length) {
        passengerListEl.innerHTML = "<p>No passengers found</p>";
        return;
      }

      chrome.storage.sync.get(["autofillProfile"], (res) => {
        const savedPassengers = res.autofillProfile?.passengers || [];

        passengerListEl.innerHTML = "";

        response.passengers.forEach((p) => {
          const isChecked = savedPassengers.includes(p.id);

          const div = document.createElement("div");

          div.innerHTML = `
            <label style="display:flex;gap:8px;cursor:pointer;">
              <input type="checkbox" value="${p.id}" ${isChecked ? "checked" : ""} />
              ${p.name}
            </label>
          `;

          passengerListEl.appendChild(div);
        });

        showStatus("Passengers loaded");
      });
    }
  );
}

// ================= FORM =================
function getFormData() {
  const data = {};

  for (const field of fields) {
    const el = document.getElementById(field);
    data[field] = el ? el.value : "";
  }

  const selected = Array.from(
    passengerListEl.querySelectorAll("input:checked")
  ).map((el) => el.value);

  data.passengers = selected;

  return data;
}

function setFormData(data) {
  for (const field of fields) {
    const el = document.getElementById(field);
    if (el) el.value = data?.[field] ?? "";
  }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  statusEl = document.getElementById("status");
  passengerListEl = document.getElementById("passengerList");
  seatToggle = document.getElementById("seatMonitorToggle");

  // Load saved form
  chrome.storage.sync.get(["autofillProfile"], (result) => {
    const saved = result.autofillProfile || {};
    setFormData(saved);
  });

  // Load passengers
  loadPassengersFromPage();

  // ================= LOAD TOGGLE STATE =================
  chrome.storage.local.get("seatMonitorEnabled", async (res) => {
    const enabled = res.seatMonitorEnabled === true;

    console.log("Loaded toggle state:", enabled);

    if (seatToggle) {
      seatToggle.checked = enabled;
    }

    // 🔥 Force sync with content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SEAT_MONITOR_TOGGLE",
        enabled: enabled
      });
    }
  });

  // ================= TOGGLE LISTENER (FIXED) =================
  if (seatToggle) {
    seatToggle.addEventListener("change", async () => {
      const enabled = seatToggle.checked;

      console.log("Saving toggle state:", enabled);

      await chrome.storage.local.set({
        seatMonitorEnabled: enabled
      });

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SEAT_MONITOR_TOGGLE",
          enabled: enabled
        });
      }

      showStatus(enabled ? "Seat Monitor ON" : "Seat Monitor OFF");
    });
  }

  // ================= SAVE BUTTON =================
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const data = getFormData();

      chrome.storage.sync.set({ autofillProfile: data }, () => {
        showStatus("Saved successfully");
      });
    });
  }

  // ================= AUTOFILL =================
  const fillBtn = document.getElementById("fillBtn");
  if (fillBtn) {
    fillBtn.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        showStatus("No active tab", true);
        return;
      }

      chrome.storage.sync.get(["autofillProfile"], (result) => {
        const profile = result.autofillProfile || {};

        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "AUTOFILL_FORM",
            payload: profile
          },
          () => {
            if (chrome.runtime.lastError) {
              showStatus("Run on booking page", true);
            } else {
              showStatus("Autofill started");
            }
          }
        );
      });
    });
  }
});