const output = document.getElementById("output");
let token = "";

function getBody() {
  return {
    email: document.getElementById("email").value.trim().toLowerCase(),
    password: document.getElementById("password").value,
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function print(value) {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

document.getElementById("registerBtn").addEventListener("click", async () => {
  try {
    const body = getBody();
    const result = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    print(result);
  } catch (error) {
    print(error.message);
  }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    const body = getBody();
    const result = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    token = result.token;
    print({ message: "Login successful", token: `${token.slice(0, 20)}...`, user: result.user });
  } catch (error) {
    print(error.message);
  }
});

document.getElementById("verifyBtn").addEventListener("click", async () => {
  if (!token) {
    print("Login first to get a token.");
    return;
  }

  try {
    const result = await request("/api/auth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    print(result);
  } catch (error) {
    print(error.message);
  }
});
