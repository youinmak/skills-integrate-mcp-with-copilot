document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authButton = document.getElementById("auth-button");
  const authStatus = document.getElementById("auth-status");
  const teacherGateMessage = document.getElementById("teacher-gate-message");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login");

  let teacherToken = localStorage.getItem("teacherToken");
  let teacherUsername = localStorage.getItem("teacherUsername");

  function isTeacherLoggedIn() {
    return Boolean(teacherToken);
  }

  function teacherAuthHeaders() {
    if (!teacherToken) {
      return {};
    }

    return {
      "X-Teacher-Token": teacherToken,
    };
  }

  function updateTeacherControls() {
    const isLoggedIn = isTeacherLoggedIn();

    authStatus.textContent = isLoggedIn
      ? `Teacher: ${teacherUsername}`
      : "Student view";
    authButton.textContent = isLoggedIn ? "Log Out" : "Login";
    teacherGateMessage.classList.toggle("hidden", isLoggedIn);

    signupForm.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !isLoggedIn;
    });
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showLoginModal() {
    loginModal.classList.remove("hidden");
  }

  function hideLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  async function logoutTeacher() {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          ...teacherAuthHeaders(),
        },
      });
    } catch (error) {
      console.error("Error while logging out:", error);
    }

    teacherToken = null;
    teacherUsername = null;
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    updateTeacherControls();
    fetchActivities();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      const loggedIn = isTeacherLoggedIn();

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        loggedIn
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}" title="Unregister student">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...teacherAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
        if (response.status === 401) {
          logoutTeacher();
        }
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  authButton.addEventListener("click", () => {
    if (isTeacherLoggedIn()) {
      logoutTeacher();
    } else {
      showLoginModal();
    }
  });

  cancelLoginButton.addEventListener("click", hideLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      hideLoginModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherToken", teacherToken);
      localStorage.setItem("teacherUsername", teacherUsername);
      updateTeacherControls();
      hideLoginModal();
      showMessage(`Logged in as ${teacherUsername}`, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...teacherAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
        if (response.status === 401) {
          logoutTeacher();
        }
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  updateTeacherControls();
  fetchActivities();
});
