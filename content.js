// ================= GLOBAL =================
let selectedPassengerNames = [];
let storedPassengerOrder = [];
let seatAssignedCount = 0;
let usedPassengers = new Set();

// ================= STORAGE =================
function loadStoredPassengerOrder(callback) {
  chrome.storage.local.get(["passengerOrder"], (res) => {
    if (res.passengerOrder && res.passengerOrder.length) {
      storedPassengerOrder = res.passengerOrder;
      console.log("📦 Loaded stored order:", storedPassengerOrder);
    } else {
      console.log("⚠️ No stored passenger order");
    }
    callback();
  });
}

// listen for live updates
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.passengerOrder) {
    storedPassengerOrder = changes.passengerOrder.newValue;

    console.log("🔄 Updated order:", storedPassengerOrder);

    const root = getPassengerRoot();
    if (root) {
      storedPassengerOrder.forEach((name) =>
        clickPassengerInsideRoot(root, name)
      );
    }
  }
});

// ================= HELPERS =================
function triggerInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function getElementByXPath(xpath) {
  try {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  } catch {
    return null;
  }
}

function getElementFromMultipleXPaths(xpaths) {
  for (const xpath of xpaths) {
    const el = getElementByXPath(xpath);
    if (el) return el;
  }
  return null;
}

function nativeSetValue(element, value) {
  const setter = Object.getOwnPropertyDescriptor(
    element.__proto__,
    "value"
  )?.set;

  setter ? setter.call(element, value) : (element.value = value);
  triggerInputEvents(element);
}

// ================= SELECT =================
function setSelect(xpaths, value) {
  const container = getElementFromMultipleXPaths(xpaths);
  if (!container) return false;

  let select =
    container.tagName === "SELECT"
      ? container
      : container.querySelector("select");

  if (!select) return false;

  nativeSetValue(select, value);
  return true;
}

// ================= DATE =================
async function setDate(xpaths, value) {
  let input = document.querySelector("input[placeholder*='date' i]");

  if (!input) {
    const container = getElementFromMultipleXPaths(xpaths);
    input = container?.querySelector("input");
  }

  if (!input) return false;

  const [y, m, d] = value.split("-");
  input.value = `${d}/${m}/${y}`;
  triggerInputEvents(input);

  return true;
}

// ================= BUTTON =================
async function clickButton(xpaths) {
  let btn = getElementFromMultipleXPaths(xpaths);

  if (!btn) {
    btn = [...document.querySelectorAll("button")].find((b) =>
      b.innerText.toLowerCase().includes("search")
    );
  }

  if (!btn) return false;

  btn.click();
  return true;
}

// ================= PASSENGERS =================
function getPassengerRoot() {
  return getElementByXPath(
    "/html/body/div[2]/main/div/div/div/div[1]/div[2]/div[1]/div/div"
  );
}

function clickPassengerInsideRoot(root, name) {
  const elements = root.querySelectorAll("p, span, div");

  for (let el of elements) {
    if (el.textContent?.trim().toLowerCase() === name.toLowerCase()) {
      let parent = el;

      for (let i = 0; i < 6; i++) {
        if (!parent) break;

        const checkbox = parent.querySelector(
          'button[role="checkbox"]'
        );

        if (checkbox) {
          if (checkbox.getAttribute("data-state") !== "checked") {
            checkbox.click();
          }

          // save order
          if (!storedPassengerOrder.includes(name)) {
            storedPassengerOrder.push(name);
            chrome.storage.local.set({
              passengerOrder: storedPassengerOrder,
            });
          }

          return;
        }

        parent = parent.parentElement;
      }
    }
  }
}

// ================= PROCEED =================
function waitAndClickProceed() {
  const interval = setInterval(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.innerText.toLowerCase().includes("proceed")
    );

    if (btn && !btn.disabled) {
      btn.click();
      clearInterval(interval);
      observeSeatSection();
    }
  }, 100);
}

// ================= OBSERVE PASSENGERS =================
function observePassengerSection(names) {
  const observer = new MutationObserver(() => {
    const root = getPassengerRoot();

    if (root) {
      names.forEach((name) =>
        clickPassengerInsideRoot(root, name)
      );

      waitAndClickProceed();
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ================= FETCH PASSENGERS =================
async function fetchPassengers() {
  try {
    const res = await fetch(
      "https://lakshadweep.irctc.co.in/api/v1/passenger",
      { credentials: "include" }
    );

    const json = await res.json();

    return {
      passengers:
        json?.data?.passengerList?.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
        })) || [],
    };
  } catch {
    return { passengers: [] };
  }
}

// ================= AUTO SELECT =================
function autoSelectPassengers(selectedIds) {
  if (!selectedIds?.length) return;

  loadStoredPassengerOrder(() => {
    fetchPassengers().then(({ passengers }) => {
      // fallback if API fails
      if (!passengers.length && storedPassengerOrder.length) {
        selectedPassengerNames = storedPassengerOrder;
        observePassengerSection(selectedPassengerNames);
        return;
      }

      let selected = passengers.filter((p) =>
        selectedIds.includes(p.id)
      );

      // apply stored order
      if (storedPassengerOrder.length) {
        selected.sort(
          (a, b) =>
            storedPassengerOrder.indexOf(a.name) -
            storedPassengerOrder.indexOf(b.name)
        );
      }

      selectedPassengerNames = selected.map((p) => p.name);

      observePassengerSection(selectedPassengerNames);
    });
  });
}

// ================= SEATS =================
function observeSeatSection() {
  const observer = new MutationObserver(() => {
    const seats = document.querySelectorAll("g");

    if (seats.length > 0) {
      observer.disconnect();
      startSeatBooking();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function clickAvailableSeat() {
  const allSeats = document.querySelectorAll("g");

  const validSeats = [];

  for (let seat of allSeats) {
    const style = seat.getAttribute("style") || "";
    if (!style.includes("cursor: pointer")) continue;

    if (seat.querySelector("image")) continue;

    const rect = seat.querySelector("rect");
    if (!rect || rect.getAttribute("fill") !== "#fff") continue;

    validSeats.push(seat);
  }

  if (!validSeats.length) return false;

  const randomSeat =
    validSeats[Math.floor(Math.random() * validSeats.length)];

  randomSeat.dispatchEvent(
    new MouseEvent("click", { bubbles: true })
  );

  return true;
}

// ================= SEAT ASSIGN =================
function forceSelectCheckboxByIndex(index) {
  const xpath = `/html/body/div[2]/main/div/div/div/div[1]/div[2]/div[2]/div/div/div[1]/div/div[2]/div/div[2]/span[${index}]/input`;

  const checkbox = getElementByXPath(xpath);
  if (!checkbox) return false;

  checkbox.click();
  checkbox.checked = true;

  checkbox.dispatchEvent(new Event("input", { bubbles: true }));
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));

  return true;
}

function handleSeatPopup() {
  if (seatAssignedCount >= selectedPassengerNames.length) return false;

  const index = seatAssignedCount + 1;

  if (forceSelectCheckboxByIndex(index)) {
    seatAssignedCount++;
    return true;
  }

  return false;
}

function startSeatBooking() {
  seatAssignedCount = 0;

  const observer = new MutationObserver(() => {
    if (seatAssignedCount >= selectedPassengerNames.length) {
      clickConfirmSeats();
      observer.disconnect();
      return;
    }

    const done = handleSeatPopup();

    if (done) {
      setTimeout(clickAvailableSeat, 100);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  clickAvailableSeat();
}

// ================= CONFIRM =================
function clickConfirmSeats() {
  const interval = setInterval(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) =>
        b.innerText.toLowerCase().includes("confirm") &&
        !b.disabled
    );

    if (btn) {
      btn.click();
      clearInterval(interval);
    }
  }, 100);
}

// ================= MAIN =================
async function autofill(profile) {
  const fromXPaths = [
    "/html/body/div[2]/main/div/div[1]/div[2]/div/form/fieldset/div[1]",
  ];

  const toXPaths = [
    "/html/body/div[2]/main/div/div[1]/div[2]/div/form/fieldset/div[2]",
  ];

  const dateXPaths = [
    "/html/body/div[2]/main/div/div[1]/div[2]/div/form/fieldset/div[3]",
  ];

  const buttonXPaths = [
    "/html/body/div[2]/main/div/div[1]/div[2]/div/form/fieldset/div[4]/button",
  ];

  setSelect(fromXPaths, profile.fromDestination);
  setSelect(toXPaths, profile.toDestination);

  await setDate(dateXPaths, profile.travelDate);
  await clickButton(buttonXPaths);

  autoSelectPassengers(profile.passengers);
}

// ================= AUTO RUN =================
chrome.storage.sync.get(["autofillProfile"], (res) => {
  const profile = res.autofillProfile || {};
  if (profile.fromDestination) autofill(profile);
});

// ================= MESSAGE =================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTOFILL_FORM") {
    autofill(request.payload);
  }

  if (request.action === "GET_PASSENGERS") {
    fetchPassengers().then(sendResponse);
    return true;
  }
});