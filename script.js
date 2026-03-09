/* ============================================
   TOPPER NOTES HUB — Main JavaScript
   ============================================ */

// Wait for the DOM to be fully loaded before running scripts
document.addEventListener("DOMContentLoaded", function () {

  /* ------------------------------------------
     1. MOBILE NAVIGATION TOGGLE
     ------------------------------------------ */
  const hamburger = document.getElementById("hamburger");
  const navMenu   = document.getElementById("navMenu");

  // Toggle mobile menu open/close when hamburger is clicked
  hamburger.addEventListener("click", function () {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("open");
  });

  // Close mobile menu when a nav link is clicked
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      hamburger.classList.remove("active");
      navMenu.classList.remove("open");
    });
  });

  /* ------------------------------------------
     2. ACTIVE NAV LINK ON SCROLL
     ------------------------------------------ */
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  function highlightNavLink() {
    var scrollY = window.scrollY + 100; // offset for sticky nav

    sections.forEach(function (section) {
      var sectionTop    = section.offsetTop;
      var sectionHeight = section.offsetHeight;
      var sectionId     = section.getAttribute("id");

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        // Remove active class from all links
        navLinks.forEach(function (link) {
          link.classList.remove("active");
        });
        // Add active class to matching link(s)
        document.querySelectorAll('.nav-link[href="#' + sectionId + '"]')
          .forEach(function (link) {
            link.classList.add("active");
          });
      }
    });
  }

  window.addEventListener("scroll", highlightNavLink);

  /* ------------------------------------------
     3. SMOOTH SCROLLING FOR ANCHOR LINKS
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      var targetId = this.getAttribute("href");
      if (targetId === "#") return;

      var target = document.querySelector(targetId);
      if (target) {
        var navHeight = document.getElementById("navbar").offsetHeight;
        var targetPosition = target.offsetTop - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth"
        });
      }
    });
  });

  /* ------------------------------------------
     4. CONTACT FORM VALIDATION
     ------------------------------------------ */
  var contactForm  = document.getElementById("contactForm");
  var nameInput    = document.getElementById("name");
  var emailInput   = document.getElementById("email");
  var messageInput = document.getElementById("message");
  var nameError    = document.getElementById("nameError");
  var emailError   = document.getElementById("emailError");
  var messageError = document.getElementById("messageError");
  var formSuccess  = document.getElementById("formSuccess");

  /**
   * Validates a single field and shows/hides its error message.
   * Returns true if valid, false otherwise.
   */
  function validateField(input, errorEl, rules) {
    var value = input.value.trim();
    var errorMsg = "";

    // Required check
    if (rules.required && value === "") {
      errorMsg = rules.requiredMsg || "This field is required.";
    }

    // Min-length check
    if (!errorMsg && rules.minLength && value.length < rules.minLength) {
      errorMsg = "Must be at least " + rules.minLength + " characters.";
    }

    // Email format check
    if (!errorMsg && rules.email) {
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        errorMsg = "Please enter a valid email address.";
      }
    }

    // Show or clear error
    if (errorMsg) {
      errorEl.textContent = errorMsg;
      input.classList.add("invalid");
      return false;
    } else {
      errorEl.textContent = "";
      input.classList.remove("invalid");
      return true;
    }
  }

  // Real-time validation: clear error as user types
  nameInput.addEventListener("input", function () {
    validateField(nameInput, nameError, { required: true, minLength: 2, requiredMsg: "Please enter your name." });
  });

  emailInput.addEventListener("input", function () {
    validateField(emailInput, emailError, { required: true, email: true, requiredMsg: "Please enter your email." });
  });

  messageInput.addEventListener("input", function () {
    validateField(messageInput, messageError, { required: true, minLength: 10, requiredMsg: "Please enter a message." });
  });

  // Form submit handler
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    formSuccess.textContent = "";

    var isNameValid    = validateField(nameInput, nameError, { required: true, minLength: 2, requiredMsg: "Please enter your name." });
    var isEmailValid   = validateField(emailInput, emailError, { required: true, email: true, requiredMsg: "Please enter your email." });
    var isMessageValid = validateField(messageInput, messageError, { required: true, minLength: 10, requiredMsg: "Please enter a message." });

    if (isNameValid && isEmailValid && isMessageValid) {
      // Save question to localStorage (viewable in Admin Panel)
      var questions = JSON.parse(localStorage.getItem("tnh_questions") || "[]");
      questions.push({
        id: "q_" + Date.now(),
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        text: messageInput.value.trim(),
        date: new Date().toISOString()
      });
      localStorage.setItem("tnh_questions", JSON.stringify(questions));

      formSuccess.textContent = "Thank you! Your message has been sent successfully.";
      contactForm.reset();

      // Clear success message after 5 seconds
      setTimeout(function () {
        formSuccess.textContent = "";
      }, 5000);
    }
  });

  /* ------------------------------------------
     5. INDEXEDDB FOR PDF STORAGE
     ------------------------------------------ */

  // IndexedDB helper — PDFs are stored here (supports files up to 300 MB)
  function openPdfDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open("tnh_pdfs_db", 1);
      request.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("pdfs")) {
          db.createObjectStore("pdfs", { keyPath: "noteId" });
        }
      };
      request.onsuccess = function (e) { resolve(e.target.result); };
      request.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getPdfFromDB(noteId) {
    return openPdfDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("pdfs", "readonly");
        var store = tx.objectStore("pdfs");
        var req = store.get(noteId);
        req.onsuccess = function () { resolve(req.result ? req.result.pdfData : null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /* ------------------------------------------
     6. DATA SEEDING & DYNAMIC RENDERING
     ------------------------------------------ */

  // Admin email constant (must match admin.html)
  var ADMIN_EMAIL = "admin@toppernoteshub.com";

  /** Seed default notes if none exist */
  function seedDefaultData() {
    if (!localStorage.getItem("tnh_notes")) {
      var defaultNotes = [
        { id:"note_default_1", title:"Class 10 Maths Premium Notes", subject:"maths class 10", description:"Complete chapter-wise notes covering all NCERT topics with solved examples and practice problems.", price:199, icon:"fa-calculator", badge:"Best Seller", badgeType:"", pdfName:"", pdfData:"", createdAt:"2026-01-15T10:00:00Z" },
        { id:"note_default_2", title:"Class 10 Science Complete Notes", subject:"science class 10", description:"Physics, Chemistry & Biology \u2014 all three in one comprehensive package with diagrams and key points.", price:249, icon:"fa-flask", badge:"New", badgeType:"new", pdfName:"", pdfData:"", createdAt:"2026-02-01T10:00:00Z" },
        { id:"note_default_3", title:"Board Exam Important Questions", subject:"board exam important questions", description:"Curated list of most-asked questions from the last 10 years of board examinations.", price:149, icon:"fa-star", badge:"", badgeType:"", pdfName:"", pdfData:"", createdAt:"2026-01-20T10:00:00Z" },
        { id:"note_default_4", title:"Previous Year Question Papers", subject:"previous year question papers", description:"Solved question papers from previous years with detailed answer keys and marking schemes.", price:99, icon:"fa-file-alt", badge:"", badgeType:"", pdfName:"", pdfData:"", createdAt:"2026-01-10T10:00:00Z" }
      ];
      localStorage.setItem("tnh_notes", JSON.stringify(defaultNotes));
    }
    if (!localStorage.getItem("tnh_videos")) {
      var defaultVideos = [
        { id:"video_default_1", title:"Trigonometry \u2014 Complete Basics", youtubeUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ", description:"Master all trigonometric ratios, identities and formulas in one session.", category:"Mathematics", createdAt:"2026-01-10T10:00:00Z" },
        { id:"video_default_2", title:"Chemical Reactions & Equations", youtubeUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ", description:"Understand balancing equations, types of reactions, and real-life examples.", category:"Chemistry", createdAt:"2026-01-12T10:00:00Z" },
        { id:"video_default_3", title:"Electricity \u2014 Full Chapter", youtubeUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ", description:"Ohm\u2019s law, circuits, resistors and numericals explained step by step.", category:"Physics", createdAt:"2026-01-14T10:00:00Z" }
      ];
      localStorage.setItem("tnh_videos", JSON.stringify(defaultVideos));
    }
    // Seed admin user account
    var users = JSON.parse(localStorage.getItem("tnh_users") || "[]");
    var adminExists = false;
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === ADMIN_EMAIL) { adminExists = true; break; }
    }
    if (!adminExists) {
      users.push({ name: "Admin", email: ADMIN_EMAIL, password: "admin123", createdAt: new Date().toISOString() });
      localStorage.setItem("tnh_users", JSON.stringify(users));
    }
  }

  /** Render note cards from localStorage into #notesGrid */
  function renderNotes() {
    var grid  = document.getElementById("notesGrid");
    var notes = JSON.parse(localStorage.getItem("tnh_notes") || "[]");
    grid.innerHTML = "";

    notes.forEach(function (note) {
      var card = document.createElement("div");
      card.className = "note-card";
      card.setAttribute("data-subject", note.subject);

      var badgeHtml = "";
      if (note.badge) {
        badgeHtml = '<div class="card-badge' + (note.badgeType === "new" ? ' new' : '') + '">' + note.badge + '</div>';
      }

      card.innerHTML =
        badgeHtml +
        '<div class="card-icon"><i class="fas ' + (note.icon || 'fa-book') + '"></i></div>' +
        '<h3>' + note.title + '</h3>' +
        '<p>' + note.description + '</p>' +
        '<div class="card-price">\u20B9' + note.price + '</div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-primary btn-sm">Buy Now</button>' +
          '<button class="btn btn-outline btn-sm btn-preview" data-note-id="' + note.id + '">Preview PDF</button>' +
        '</div>';

      grid.appendChild(card);
    });

    // Attach preview PDF handlers (fetch PDF from IndexedDB)
    grid.querySelectorAll(".btn-preview").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var noteId = this.getAttribute("data-note-id");
        var allNotes = JSON.parse(localStorage.getItem("tnh_notes") || "[]");
        var note = null;
        for (var i = 0; i < allNotes.length; i++) {
          if (allNotes[i].id === noteId) { note = allNotes[i]; break; }
        }
        if (!note || !note.pdfName) {
          alert("PDF preview not available for this note.");
          return;
        }
        // Fetch from IndexedDB
        getPdfFromDB(noteId).then(function (pdfData) {
          if (pdfData) {
            var blob = new Blob([pdfData], { type: "application/pdf" });
            var url = URL.createObjectURL(blob);
            window.open(url, "_blank");
          } else {
            alert("PDF preview not available for this note.");
          }
        }).catch(function () {
          alert("Error loading PDF. Please try again.");
        });
      });
    });
  }

  /** Render video cards from localStorage into #videoGrid */
  function renderVideos() {
    var grid   = document.getElementById("videoGrid");
    var videos = JSON.parse(localStorage.getItem("tnh_videos") || "[]");
    grid.innerHTML = "";

    videos.forEach(function (video) {
      var card = document.createElement("div");
      card.className = "video-card";

      card.innerHTML =
        '<div class="video-embed">' +
          '<iframe src="' + video.youtubeUrl + '" title="' + video.title + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
        '</div>' +
        '<div class="video-info">' +
          '<h3>' + video.title + '</h3>' +
          '<p>' + video.description + '</p>' +
        '</div>';

      grid.appendChild(card);
    });
  }

  // Seed data, then render
  seedDefaultData();
  renderNotes();
  renderVideos();

  /* ------------------------------------------
     6. SCROLL REVEAL ANIMATIONS
     ------------------------------------------ */

  // Add the 'reveal' class to elements we want to animate on scroll
  var revealSelectors = [
    ".note-card",
    ".video-card",
    ".resource-card",
    ".testimonial-card",
    ".section-title",
    ".section-subtitle",
    ".cta-content",
    ".contact-form"
  ];

  revealSelectors.forEach(function (selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.add("reveal");
    });
  });

  /**
   * Checks each .reveal element and adds 'visible' class
   * when it enters the viewport.
   */
  function scrollReveal() {
    var revealElements = document.querySelectorAll(".reveal");
    var windowHeight   = window.innerHeight;
    var revealPoint    = 120; // pixels from the bottom of the viewport

    revealElements.forEach(function (el) {
      var elementTop = el.getBoundingClientRect().top;

      if (elementTop < windowHeight - revealPoint) {
        el.classList.add("visible");
      }
    });
  }

  window.addEventListener("scroll", scrollReveal);
  // Run once on page load to reveal elements already in view
  scrollReveal();

  /* ------------------------------------------
     7. SEARCH / FILTER FOR NOTES
     ------------------------------------------ */
  var notesSearch = document.getElementById("notesSearch");

  notesSearch.addEventListener("input", function () {
    var query = this.value.toLowerCase().trim();
    // Re-query each time since cards are rendered dynamically
    var currentCards = document.querySelectorAll(".note-card");

    currentCards.forEach(function (card) {
      var subject = (card.getAttribute("data-subject") || "").toLowerCase();
      var heading = (card.querySelector("h3") ? card.querySelector("h3").textContent : "").toLowerCase();

      if (subject.includes(query) || heading.includes(query)) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });
  });

  /* ------------------------------------------
     8. AUTH SYSTEM (Login / Sign Up)
     ------------------------------------------ */

  // DOM references
  var authOverlay    = document.getElementById("authOverlay");
  var authClose      = document.getElementById("authClose");
  var openLoginBtn   = document.getElementById("openLoginBtn");
  var openSignupBtn  = document.getElementById("openSignupBtn");
  var navAuth        = document.getElementById("navAuth");
  var userMenuEl     = document.getElementById("userMenu");
  var userMenuToggle = document.getElementById("userMenuToggle");
  var userDropdown   = document.getElementById("userDropdown");
  var userNameEl     = document.getElementById("userName");
  var userEmailEl    = document.getElementById("userEmail");
  var logoutBtn      = document.getElementById("logoutBtn");

  var loginForm      = document.getElementById("loginForm");
  var signupForm     = document.getElementById("signupForm");
  var authTabs       = document.querySelectorAll(".auth-tab");

  // --- Helper: open / close auth modal ---
  function openAuthModal(tab) {
    authOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
    switchAuthTab(tab || "login");
  }

  function closeAuthModal() {
    authOverlay.classList.remove("open");
    document.body.style.overflow = "";
    clearAuthForms();
  }

  // Open modal buttons
  openLoginBtn.addEventListener("click", function () { openAuthModal("login"); });
  openSignupBtn.addEventListener("click", function () { openAuthModal("signup"); });

  // Close modal
  authClose.addEventListener("click", closeAuthModal);
  authOverlay.addEventListener("click", function (e) {
    if (e.target === authOverlay) closeAuthModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && authOverlay.classList.contains("open")) {
      closeAuthModal();
    }
  });

  // --- Tab switching ---
  function switchAuthTab(tab) {
    authTabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });
    if (tab === "login") {
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    } else {
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    }
  }

  authTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchAuthTab(this.getAttribute("data-tab"));
    });
  });

  // "Switch" links inside forms (e.g. "Don't have an account? Sign Up")
  document.querySelectorAll("[data-switch]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      switchAuthTab(this.getAttribute("data-switch"));
    });
  });

  // --- Password show/hide toggle ---
  document.querySelectorAll(".password-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = this.parentElement.querySelector("input");
      var icon  = this.querySelector("i");
      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });

  // --- Clear all auth form fields and errors ---
  function clearAuthForms() {
    loginForm.reset();
    signupForm.reset();
    document.querySelectorAll(".auth-form .error-msg").forEach(function (el) { el.textContent = ""; });
    document.querySelectorAll(".auth-form input").forEach(function (el) { el.classList.remove("invalid"); });
    document.querySelectorAll(".auth-message").forEach(function (el) { el.textContent = ""; el.className = "auth-message"; });
  }

  // --- Reuse existing validateField helper for auth forms ---
  // (already defined above in section 4)

  // --- LOGIN form submit ---
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var loginEmailInput    = document.getElementById("loginEmail");
    var loginPasswordInput = document.getElementById("loginPassword");
    var loginEmailError    = document.getElementById("loginEmailError");
    var loginPasswordError = document.getElementById("loginPasswordError");
    var loginMessage       = document.getElementById("loginMessage");

    var emailOk = validateField(loginEmailInput, loginEmailError, { required: true, email: true, requiredMsg: "Please enter your email." });
    var passOk  = validateField(loginPasswordInput, loginPasswordError, { required: true, minLength: 6, requiredMsg: "Please enter your password." });

    if (!emailOk || !passOk) return;

    // Check against stored users in localStorage
    var users = JSON.parse(localStorage.getItem("tnh_users") || "[]");
    var email = loginEmailInput.value.trim();
    var pass  = loginPasswordInput.value;

    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === email && users[i].password === pass) {
        user = users[i];
        break;
      }
    }

    if (user) {
      // Save session
      localStorage.setItem("tnh_session", JSON.stringify({ name: user.name, email: user.email }));

      var isAdmin = user.email === ADMIN_EMAIL;
      if (isAdmin) {
        loginMessage.innerHTML = '<i class="fas fa-shield-alt"></i> Welcome, Admin! Redirecting to Admin Panel...';
        loginMessage.className = "auth-message success";
        setTimeout(function () {
          closeAuthModal();
          updateAuthUI();
          window.location.href = "admin.html";
        }, 1200);
      } else {
        loginMessage.textContent = "Login successful! Welcome back, " + user.name + ".";
        loginMessage.className = "auth-message success";
        setTimeout(function () {
          closeAuthModal();
          updateAuthUI();
        }, 800);
      }
    } else {
      loginMessage.textContent = "Invalid email or password. Please try again.";
      loginMessage.className = "auth-message error";
    }
  });

  // --- SIGNUP form submit ---
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var signupNameInput     = document.getElementById("signupName");
    var signupEmailInput    = document.getElementById("signupEmail");
    var signupPasswordInput = document.getElementById("signupPassword");
    var signupConfirmInput  = document.getElementById("signupConfirm");
    var signupNameError     = document.getElementById("signupNameError");
    var signupEmailError    = document.getElementById("signupEmailError");
    var signupPasswordError = document.getElementById("signupPasswordError");
    var signupConfirmError  = document.getElementById("signupConfirmError");
    var signupMessage       = document.getElementById("signupMessage");

    var nameOk  = validateField(signupNameInput, signupNameError, { required: true, minLength: 2, requiredMsg: "Please enter your name." });
    var emailOk = validateField(signupEmailInput, signupEmailError, { required: true, email: true, requiredMsg: "Please enter your email." });
    var passOk  = validateField(signupPasswordInput, signupPasswordError, { required: true, minLength: 6, requiredMsg: "Please create a password." });

    // Confirm password check
    var confirmOk = true;
    if (signupConfirmInput.value === "") {
      signupConfirmError.textContent = "Please confirm your password.";
      signupConfirmInput.classList.add("invalid");
      confirmOk = false;
    } else if (signupConfirmInput.value !== signupPasswordInput.value) {
      signupConfirmError.textContent = "Passwords do not match.";
      signupConfirmInput.classList.add("invalid");
      confirmOk = false;
    } else {
      signupConfirmError.textContent = "";
      signupConfirmInput.classList.remove("invalid");
    }

    if (!nameOk || !emailOk || !passOk || !confirmOk) return;

    // Check if email already registered
    var users = JSON.parse(localStorage.getItem("tnh_users") || "[]");
    var newEmail = signupEmailInput.value.trim();

    for (var i = 0; i < users.length; i++) {
      if (users[i].email === newEmail) {
        signupMessage.textContent = "An account with this email already exists.";
        signupMessage.className = "auth-message error";
        return;
      }
    }

    // Save new user
    var newUser = {
      name: signupNameInput.value.trim(),
      email: newEmail,
      password: signupPasswordInput.value,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem("tnh_users", JSON.stringify(users));

    // Auto-login
    localStorage.setItem("tnh_session", JSON.stringify({ name: newUser.name, email: newUser.email }));

    signupMessage.textContent = "Account created successfully! Welcome, " + newUser.name + ".";
    signupMessage.className = "auth-message success";
    setTimeout(function () {
      closeAuthModal();
      updateAuthUI();
    }, 800);
  });

  // --- User dropdown toggle ---
  userMenuToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    userMenuToggle.classList.toggle("open");
    userDropdown.classList.toggle("open");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (!userMenuEl.contains(e.target)) {
      userMenuToggle.classList.remove("open");
      userDropdown.classList.remove("open");
    }
  });

  // --- Logout ---
  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("tnh_session");
    userMenuToggle.classList.remove("open");
    userDropdown.classList.remove("open");
    updateAuthUI();
  });

  // --- Update navbar UI based on session ---
  function updateAuthUI() {
    var session = JSON.parse(localStorage.getItem("tnh_session"));
    var adminLink = document.getElementById("adminLink");
    var roleBadge = document.getElementById("roleBadge");
    if (session) {
      navAuth.classList.add("hidden");
      userMenuEl.classList.remove("hidden");
      userNameEl.textContent = session.name;
      userEmailEl.textContent = session.email;

      var isAdmin = session.email === ADMIN_EMAIL;

      // Role badge
      if (roleBadge) {
        roleBadge.textContent = isAdmin ? "Admin" : "Student";
        roleBadge.className = "role-badge " + (isAdmin ? "admin" : "student");
      }

      // Show admin link only for admin user
      if (adminLink) {
        if (isAdmin) {
          adminLink.classList.remove("hidden");
        } else {
          adminLink.classList.add("hidden");
        }
      }
    } else {
      navAuth.classList.remove("hidden");
      userMenuEl.classList.add("hidden");
      if (adminLink) adminLink.classList.add("hidden");
      if (roleBadge) { roleBadge.textContent = ""; roleBadge.className = "role-badge"; }
    }
  }

  // Run on page load to restore session
  updateAuthUI();

});
