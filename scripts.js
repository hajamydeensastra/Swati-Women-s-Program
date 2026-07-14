/* ==========================================================================
   INSTITUTIONAL CORE SYSTEM ENGINE (MODULAR RUNTIME)
   ========================================================================== */

// 1. DYNAMIC DEPLOYMENT CONFIGURATIONS
const DEPLOYMENT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyZJQZVHj3bDl8aHxSxJiDCLN25LnrnG7DtVP9uYYBmkJwLpwLS_VwYFQ7RfPtqeu-L/exec"; // Replace with your Google Apps Script Deployment Web App URL

// 2. RUNTIME DATABASE STATE SCHEMA
const SYSTEM_SCHEMA = {
  MASTER_USERS: ["UID", "Name", "Password", "Role", "RecordID"],
  MASTER_COURSES: ["CourseCode", "CourseName", "Department", "RecordID"],
  MASTER_CLASSES: ["ClassID", "ClassName", "CourseCode", "Department", "RecordID"],
  MASTER_SUBJECTS: ["SubjectCode", "SubjectName", "CourseCode", "Department", "RecordID"],
  MASTER_STAFFS: ["StaffID", "StaffName", "Department", "Contact", "RecordID"],
  MASTER_STUDENTS: ["StudentID", "StudentName", "ClassID", "CourseCode", "DOB", "Contact", "RecordID"],
  CLASS_TIMETABLES: ["ClassID", "Day", "Hour_1", "Hour_2", "Hour_3", "Hour_4", "Hour_5", "Hour_6", "Hour_7", "Hour_8", "Hour_9", "Hour_10", "RecordID"],
  DAILY_ATTENDANCE: ["Date", "SubjectCode", "ClassID", "StudentID", "Status", "MarkedBy", "RecordID"]
};

// 3. INTERNAL RUNTIME MEMORY
let activeUserSession = { role: "", uid: "", name: "" };
let syncInProgressState = false;
let editingRowIndices = {
  MASTER_USERS: -1,
  MASTER_COURSES: -1,
  MASTER_CLASSES: -1,
  MASTER_SUBJECTS: -1,
  MASTER_STAFFS: -1,
  MASTER_STUDENTS: -1,
  CLASS_TIMETABLES: -1,
  DAILY_ATTENDANCE: -1
};

// 4. ON SYSTEM LOAD INITIALIZER
window.addEventListener("DOMContentLoaded", () => {
  initializeLocalDatabases();
  setupGlobalEvents();
  autoLoginIfSessionExists();
});

// Setup LocalStorage with structure if empty
function initializeLocalDatabases() {
  Object.keys(SYSTEM_SCHEMA).forEach(key => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
    }
  });
}

function setupGlobalEvents() {
  // Navigation Menu Event Handlers
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      const targetSectionId = item.getAttribute("data-target");
      const sections = document.querySelectorAll(".tab-content");
      sections.forEach(s => s.classList.remove("active"));
      
      const targetSec = document.getElementById(targetSectionId);
      if(targetSec) targetSec.classList.add("active");
    });
  });

  // Timetable Generator Dynamic Select Rules
  const ttClassSelect = document.getElementById("tt-class-select");
  if(ttClassSelect) {
    ttClassSelect.addEventListener("change", renderTimetableGridDisplay);
  }
}

function autoLoginIfSessionExists() {
  const cachedUser = localStorage.getItem("ACTIVE_SESSION_CACHE");
  if (cachedUser) {
    const parsed = JSON.parse(cachedUser);
    activeUserSession = parsed;
    applyAuthorizationRules(parsed.role, parsed.name);
  }
}

// 5. SECURE ENDPOINT SYNCHRONIZATION
function setGlobalSyncState(status) {
  syncInProgressState = status;
  const syncBtn = document.getElementById("cloud-sync-btn");
  if (syncBtn) {
    if (status) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    } else {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Pull & Sync';
    }
  }
}

function syncAllFromGoogleSheets() {
  if (syncInProgressState) return;
  setGlobalSyncState(true);

  fetch(`${DEPLOYMENT_WEB_APP_URL}?action=fetchAll`)
    .then(res => res.json())
    .then(networkData => {
      if (networkData.status === "error") {
        alert("Pull Engine Error: " + networkData.message);
        return;
      }
      Object.keys(SYSTEM_SCHEMA).forEach(key => {
        let backendSheetName = sheetTabForKey(key);
        if (backendSheetName && networkData[backendSheetName]) {
          localStorage.setItem(key, JSON.stringify(networkData[backendSheetName]));
        }
      });
      renderAllTables();
      refreshFormDropdownLists();
      alert("System database successfully synchronized and refreshed!");
    })
    .catch(err => {
      console.error(err);
      alert("Connection failure with backend server. Check web app URL or sheet locks.");
    })
    .finally(() => setGlobalSyncState(false));
}

function syncWithGoogleSheet(sheetTab, payload, headers, action, recordId = "") {
  if (!DEPLOYMENT_WEB_APP_URL) return;
  
  // Apps Script code-oda strict mapping-ku yetha madi variable names-ai mathiyachubro!
  const requestBody = {
    tabName: sheetTab,       // Changed from sheetName to tabName
    action: action,
    payload: payload,
    headers: headers,
    rowId: recordId          // Changed from recordId to rowId
  };

  // POST request fetch configuration optimized for Google Redirects
  fetch(DEPLOYMENT_WEB_APP_URL, {
    method: "POST",
    mode: "cors",            // Changed from no-cors to cors for better handshake
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script accepts text/plain best in CORS
    body: JSON.stringify(requestBody)
  })
  .then(res => res.json())
  .then(resData => {
     console.log("Cloud Engine Status:", resData);
  })
  .catch(err => console.warn("Google sheet background synchronization logging:", err));
}

function sheetTabForKey(key, optionalRowData = null) {
  const map = {
    MASTER_USERS: "Master_Users",
    MASTER_COURSES: "Master_Courses",
    MASTER_CLASSES: "Master_Classes",
    MASTER_SUBJECTS: "Master_Subjects",
    MASTER_STAFFS: "Master_Staffs",
    MASTER_STUDENTS: "Master_Students",
    CLASS_TIMETABLES: "Class_Timetables",
    DAILY_ATTENDANCE: "Daily_Class_Attendance"
  };
  let baseTab = map[key] || "";
  if (key === "DAILY_ATTENDANCE" && optionalRowData) {
    let classId = optionalRowData[2];
    if (classId) return "Class_Att_" + classId;
  }
  return baseTab;
}

// 6. ROLE CONFIGURATION GATEWAY
function handleSystemLogin() {
  const uid = document.getElementById("login-uid").value.trim();
  const pass = document.getElementById("login-pass").value.trim();
  const errorMsg = document.getElementById("login-error");

  if (!uid || !pass) {
    errorMsg.innerText = "Please provide valid credentials!";
    errorMsg.style.display = "block";
    return;
  }

  errorMsg.style.display = "none";

  // Check if Master Users Database is present
  const users = JSON.parse(localStorage.getItem("MASTER_USERS")) || [];
  let userRecord = users.find(u => u[0] == uid && u[2] == pass);

  if (userRecord) {
    activeUserSession = { role: userRecord[3], uid: userRecord[0], name: userRecord[1] };
    localStorage.setItem("ACTIVE_SESSION_CACHE", JSON.stringify(activeUserSession));
    applyAuthorizationRules(userRecord[3], userRecord[1]);
  } else if (uid === "admin" && pass === "admin") {
    activeUserSession = { role: "ADMIN", uid: "admin", name: "System Adminstrator" };
    localStorage.setItem("ACTIVE_SESSION_CACHE", JSON.stringify(activeUserSession));
    applyAuthorizationRules("ADMIN", "System Adminstrator");
  } else {
    errorMsg.innerText = "Authentication Failed: Invalid user credentials.";
    errorMsg.style.display = "block";
  }
}

function applyAuthorizationRules(role, name) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("global-header").style.display = "block";
  document.getElementById("main-sidebar").style.display = "flex";
  document.getElementById("main-content-area").style.display = "block";

  document.getElementById("user-display-tag").innerText = name;
  document.getElementById("role-display-tag").innerText = role;

  const adminMenuOpts = document.querySelectorAll(".admin-only-opt");
  const staffMenuOpts = document.querySelectorAll(".staff-only-opt");

  if (role === "ADMIN") {
    adminMenuOpts.forEach(el => el.style.display = "flex");
    staffMenuOpts.forEach(el => el.style.display = "flex");
    document.getElementById("mode-flag-badge").innerText = "ADMINISTRATION INSTANCE";
    triggerNavigationTabChange("dashboard-section");
  } else if (role === "STAFF") {
    adminMenuOpts.forEach(el => el.style.display = "none");
    staffMenuOpts.forEach(el => el.style.display = "flex");
    document.getElementById("mode-flag-badge").innerText = "FACULTY PORTAL";
    triggerNavigationTabChange("staff-attendance-section");
  } else if (role === "STUDENT") {
    adminMenuOpts.forEach(el => el.style.display = "none");
    staffMenuOpts.forEach(el => el.style.display = "none");
    document.getElementById("mode-flag-badge").innerText = "STUDENT COUNSEL PORTAL";
    triggerNavigationTabChange("student-profile-section");
    renderStudentSelfProfileViewer();
  }

  renderAllTables();
  refreshFormDropdownLists();
}

function triggerNavigationTabChange(tabId) {
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach(item => {
    if (item.getAttribute("data-target") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
  const sections = document.querySelectorAll(".tab-content");
  sections.forEach(s => {
    if (s.id === tabId) {
      s.classList.add("active");
    } else {
      s.classList.remove("active");
    }
  });
}

function handleLogout() {
  activeUserSession = { role: "", uid: "", name: "" };
  localStorage.removeItem("ACTIVE_SESSION_CACHE");
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("global-header").style.display = "none";
  document.getElementById("main-sidebar").style.display = "none";
  document.getElementById("main-content-area").style.display = "none";
  
  // Clear input fields safely
  document.getElementById("login-uid").value = "";
  document.getElementById("login-pass").value = "";
  document.getElementById("login-error").style.display = "none";
}

// 7. DROPDOWN SELECTION BUILDERS
function refreshFormDropdownLists() {
  const courseList = JSON.parse(localStorage.getItem("MASTER_COURSES")) || [];
  const classList = JSON.parse(localStorage.getItem("MASTER_CLASSES")) || [];
  const subjectList = JSON.parse(localStorage.getItem("MASTER_SUBJECTS")) || [];
  const staffList = JSON.parse(localStorage.getItem("MASTER_STAFFS")) || [];

  populateSelectControl("cls-course-select", courseList, 0, 1);
  populateSelectControl("sub-course-select", courseList, 0, 1);
  populateSelectControl("std-course-select", courseList, 0, 1);

  populateSelectControl("std-class-select", classList, 0, 1);
  populateSelectControl("tt-class-select", classList, 0, 1);
  populateSelectControl("att-class-select", classList, 0, 1);

  populateSelectControl("att-subject-select", subjectList, 0, 1);

  // Populate dynamic cells selectors inside timetable creator
  for (let hourIdx = 1; hourIdx <= 10; hourIdx++) {
    populateSelectControl(`tt-sub-h${hourIdx}`, subjectList, 0, 1, "FREE PERIOD");
    populateSelectControl(`tt-staff-h${hourIdx}`, staffList, 0, 1, "NO FACULTY ASSIGNED");
  }
}

function populateSelectControl(elementId, dataset, valueColIndex, textColIndex, defaultAlternativeText = null) {
  const selectNode = document.getElementById(elementId);
  if (!selectNode) return;
  selectNode.innerHTML = "";

  if (defaultAlternativeText) {
    let opt = document.createElement("option");
    opt.value = "";
    opt.text = defaultAlternativeText;
    selectNode.appendChild(opt);
  } else {
    let opt = document.createElement("option");
    opt.value = "";
    opt.text = `-- Select Option --`;
    selectNode.appendChild(opt);
  }

  dataset.forEach(row => {
    let opt = document.createElement("option");
    opt.value = row[valueColIndex];
    opt.text = `${row[valueColIndex]} - ${row[textColIndex]}`;
    selectNode.appendChild(opt);
  });
}

// 8. CRUD SAVE GATEWAY & VALIDATION
function handleFormSubmission(tblKey, inputControlIds, resetFormElementId = null) {
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let formValues = inputControlIds.map(id => document.getElementById(id).value.trim());

  if (formValues.some(val => val === "")) {
    alert("Mandatory Fields Violation: Complete all input fields before saving.");
    return;
  }

  let recordId = "";
  let activeIndex = editingRowIndices[tblKey];

  if (activeIndex > -1) {
    // Record update scenario
    let targetRowData = valuesMatrix[activeIndex];
    recordId = targetRowData[targetRowData.length - 1]; // Unique Row Key
    formValues.push(recordId);
    valuesMatrix[activeIndex] = formValues;
    editingRowIndices[tblKey] = -1;

    let targetTab = sheetTabForKey(tblKey, formValues);
    if (targetTab) {
      syncWithGoogleSheet(targetTab, formValues, SYSTEM_SCHEMA[tblKey], "UPDATE", recordId);
    }
  } else {
    // New creation entry scenario
    recordId = "REC-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    formValues.push(recordId);
    valuesMatrix.push(formValues);

    let targetTab = sheetTabForKey(tblKey, formValues);
    if (targetTab) {
      syncWithGoogleSheet(targetTab, formValues, SYSTEM_SCHEMA[tblKey], "CREATE");
    }
  }

  localStorage.setItem(tblKey, JSON.stringify(valuesMatrix));
  renderAllTables();
  refreshFormDropdownLists();

  if (resetFormElementId) {
    document.getElementById(resetFormElementId).reset();
  }

  // Handle specific action trigger loops
  if (tblKey === "CLASS_TIMETABLES") {
    renderTimetableGridDisplay();
  }
}

function handleUniversalEdit(tblKey, rowIdx, inputControlIds) {
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let targetRow = valuesMatrix[rowIdx];
  if (!targetRow) return;

  editingRowIndices[tblKey] = rowIdx;

  inputControlIds.forEach((id, idx) => {
    const inputControl = document.getElementById(id);
    if (inputControl) {
      inputControl.value = targetRow[idx] || "";
    }
  });

  // Highlight action state to user
  alert("Row data loaded into the target inputs. Modify values and submit form to save changes.");
}

function handleUniversalDelete(tblKey, rowIdx) {
  if (!confirm("Are you sure you want to permanently delete this record?")) return;
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let targetRowData = valuesMatrix[rowIdx];
  let recordId = targetRowData[targetRowData.length - 1];

  let targetTab = sheetTabForKey(tblKey, targetRowData);
  if (targetTab) {
    syncWithGoogleSheet(targetTab, [], [], "DELETE", recordId);
  }

  valuesMatrix.splice(rowIdx, 1);
  localStorage.setItem(tblKey, JSON.stringify(valuesMatrix));

  if (editingRowIndices[tblKey] === rowIdx) {
    editingRowIndices[tblKey] = -1;
  }

  renderAllTables();
  refreshFormDropdownLists();
  
  if (tblKey === "CLASS_TIMETABLES") {
    renderTimetableGridDisplay();
  }
}

// 9. DYNAMIC GRID & TABLE RENDERERS
function renderAllTables() {
  renderDatasetToTable("user-table-body", "MASTER_USERS", [0, 1, 3], ["UID", "Name", "Role"]);
  renderDatasetToTable("course-table-body", "MASTER_COURSES", [0, 1, 2], ["Course Code", "Course Name", "Dept"]);
  renderDatasetToTable("class-table-body", "MASTER_CLASSES", [0, 1, 2], ["Class ID", "Class Name", "Course Code"]);
  renderDatasetToTable("subject-table-body", "MASTER_SUBJECTS", [0, 1, 2, 3], ["Subject Code", "Subject Name", "Course Code", "Dept"]);
  renderDatasetToTable("staff-table-body", "MASTER_STAFFS", [0, 1, 2, 3], ["Staff ID", "Name", "Dept", "Contact"]);
  renderDatasetToTable("student-table-body", "MASTER_STUDENTS", [0, 1, 2, 3, 4, 5], ["Student ID", "Name", "Class ID", "Course", "DOB", "Contact"]);
  renderDatasetToTable("timetable-table-body", "CLASS_TIMETABLES", [0, 1], ["Class ID", "Day"]);
}

function renderDatasetToTable(tbodyId, tblKey, displayColIndices, headerLabels) {
  const tbodyNode = document.getElementById(tbodyId);
  if (!tbodyNode) return;
  tbodyNode.innerHTML = "";

  const rawDataset = JSON.parse(localStorage.getItem(tblKey)) || [];
  const searchFilterVal = getSearchFilterText(tbodyId);

  rawDataset.forEach((row, originalRowIndex) => {
    // Perform live text filtering match checks
    if (searchFilterVal) {
      let containsMatchStr = row.some(col => String(col).toLowerCase().includes(searchFilterVal));
      if (!containsMatchStr) return;
    }

    let tr = document.createElement("tr");

    displayColIndices.forEach(colIdx => {
      let td = document.createElement("td");
      td.innerText = row[colIdx] || "";
      tr.appendChild(td);
    });

    // Generate Context Control Action Buttons
    let actionTd = document.createElement("td");
    actionTd.className = "actions-cell-flex";

    let editBtn = document.createElement("button");
    editBtn.className = "btn-table-edit";
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editBtn.addEventListener("click", () => {
      // Map and extract targeted dynamic inputs based on UI key layout
      let targetInputIds = getInputIdsForTableKey(tblKey);
      handleUniversalEdit(tblKey, originalRowIndex, targetInputIds);
    });

    let delBtn = document.createElement("button");
    delBtn.className = "btn-table-del";
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
    delBtn.addEventListener("click", () => {
      handleUniversalDelete(tblKey, originalRowIndex);
    });

    actionTd.appendChild(editBtn);
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);

    tbodyNode.appendChild(tr);
  });
}

function getSearchFilterText(tbodyId) {
  const searchInputsMap = {
    "user-table-body": "search-user",
    "course-table-body": "search-course",
    "class-table-body": "search-class",
    "subject-table-body": "search-subject",
    "staff-table-body": "search-staff",
    "student-table-body": "search-student",
    "timetable-table-body": "search-timetable"
  };
  const inputElId = searchInputsMap[tbodyId];
  if (!inputElId) return "";
  const el = document.getElementById(inputElId);
  return el ? el.value.trim().toLowerCase() : "";
}

function triggerSearchFilter(tbodyId) {
  renderAllTables();
}

function getInputIdsForTableKey(tblKey) {
  const formsMapping = {
    MASTER_USERS: ["user-uid", "user-name", "user-pass", "user-role"],
    MASTER_COURSES: ["crs-code", "crs-name", "crs-dept"],
    MASTER_CLASSES: ["cls-id", "cls-name", "cls-course-select", "cls-dept"],
    MASTER_SUBJECTS: ["sub-code", "sub-name", "sub-course-select", "sub-dept"],
    MASTER_STAFFS: ["stf-id", "stf-name", "stf-dept", "stf-contact"],
    MASTER_STUDENTS: ["std-id", "std-name", "std-class-select", "std-course-select", "std-dob", "std-contact"],
    CLASS_TIMETABLES: [
      "tt-class-select", "tt-day-select",
      "tt-sub-h1", "tt-staff-h1", "tt-sub-h2", "tt-staff-h2",
      "tt-sub-h3", "tt-staff-h3", "tt-sub-h4", "tt-staff-h4",
      "tt-sub-h5", "tt-staff-h5", "tt-sub-h6", "tt-staff-h6",
      "tt-sub-h7", "tt-staff-h7", "tt-sub-h8", "tt-staff-h8",
      "tt-sub-h9", "tt-staff-h9", "tt-sub-h10", "tt-staff-h10"
    ]
  };
  return formsMapping[tblKey] || [];
}

// 10. TIMETABLE RUNTIME LAYOUT MATRIX BUILDER
function saveTimetableRecord() {
  const classId = document.getElementById("tt-class-select").value;
  const targetDay = document.getElementById("tt-day-select").value;

  if (!classId || !targetDay) {
    alert("Please select Class and Day configuration to build matrix!");
    return;
  }

  let dynamicPayload = [classId, targetDay];

  for (let hr = 1; hr <= 10; hr++) {
    const subVal = document.getElementById(`tt-sub-h${hr}`).value || "FREE PERIOD";
    const staffVal = document.getElementById(`tt-staff-h${hr}`).value || "NO FACULTY ASSIGNED";
    dynamicPayload.push(`${subVal}|${staffVal}`);
  }

  // Handle overwrite duplicates locally
  let ttList = JSON.parse(localStorage.getItem("CLASS_TIMETABLES")) || [];
  let existingIndex = ttList.findIndex(row => row[0] === classId && row[1] === targetDay);

  let recordId = "";
  if (existingIndex > -1) {
    recordId = ttList[existingIndex][ttList[existingIndex].length - 1];
    dynamicPayload.push(recordId);
    ttList[existingIndex] = dynamicPayload;
  } else {
    recordId = "REC-" + Date.now();
    dynamicPayload.push(recordId);
    ttList.push(dynamicPayload);
  }

  localStorage.setItem("CLASS_TIMETABLES", JSON.stringify(ttList));
  renderAllTables();
  renderTimetableGridDisplay();

  let targetTab = sheetTabForKey("CLASS_TIMETABLES", dynamicPayload);
  if (targetTab) {
    syncWithGoogleSheet(targetTab, dynamicPayload, SYSTEM_SCHEMA["CLASS_TIMETABLES"], "CREATE");
  }

  alert("Timetable Period mapping configurations saved successfully!");
}

function renderTimetableGridDisplay() {
  const classId = document.getElementById("tt-class-select").value;
  const gridContainer = document.getElementById("tt-matrix-runtime-grid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";
  if (!classId) return;

  const ttList = JSON.parse(localStorage.getItem("CLASS_TIMETABLES")) || [];
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

  // Inject structural headers
  gridContainer.appendChild(createHeaderCell("DAY / HOUR"));
  for (let hr = 1; hr <= 10; hr++) {
    if (hr === 5) gridContainer.appendChild(createHeaderCell("LUNCH BREAK"));
    gridContainer.appendChild(createHeaderCell(`PERIOD ${hr}`));
  }

  // Render Day Mapping Rows
  days.forEach(dayName => {
    let dayRowCell = document.createElement("div");
    dayRowCell.className = "tt-cell tt-day";
    dayRowCell.innerText = dayName;
    gridContainer.appendChild(dayRowCell);

    let mappedDayData = ttList.find(row => row[0] === classId && row[1] === dayName);

    for (let hr = 1; hr <= 10; hr++) {
      if (hr === 5) {
        let lunchBreak = document.createElement("div");
        lunchBreak.className = "tt-cell tt-break";
        lunchBreak.innerText = "LUNCH";
        gridContainer.appendChild(lunchBreak);
      }

      let cellValue = mappedDayData ? mappedDayData[hr + 1] : "";
      let cellNode = document.createElement("div");
      cellNode.className = "tt-cell";

      if (cellValue && cellValue.includes("|")) {
        let [sub, staff] = cellValue.split("|");
        let subTitle = document.createElement("div");
        subTitle.className = "tt-subject-title";
        subTitle.innerText = sub || "FREE PERIOD";

        let staffLbl = document.createElement("div");
        staffLbl.className = "tt-staff-lbl";
        staffLbl.innerText = staff || "NO FACULTY ASSIGNED";

        cellNode.appendChild(subTitle);
        cellNode.appendChild(staffLbl);
      } else {
        cellNode.innerText = "-";
      }
      gridContainer.appendChild(cellNode);
    }
  });
}

function createHeaderCell(text) {
  let cell = document.createElement("div");
  cell.className = "tt-header";
  cell.innerText = text;
  return cell;
}

// 11. FACULTY ATTENDANCE UTILITY MODULE
function generateAttendanceRegisterForm() {
  const classId = document.getElementById("att-class-select").value;
  const activeDate = document.getElementById("att-date-picker").value;
  const activeSub = document.getElementById("att-subject-select").value;
  const listContainer = document.getElementById("att-students-list-view");

  if (!classId || !activeDate || !activeSub) {
    alert("Select Class, Target Date and Subject Code to initiate attendance capture register!");
    return;
  }

  listContainer.innerHTML = "";

  const studentsList = JSON.parse(localStorage.getItem("MASTER_STUDENTS")) || [];
  const classStudents = studentsList.filter(s => s[2] === classId);

  if (classStudents.length === 0) {
    listContainer.innerHTML = "<p style='padding: 20px; color: #64748b; font-weight: 600;'>No registered students found in this Class.</p>";
    return;
  }

  // Check if attendance is already present
  const fullAttendanceLogs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];

  let table = document.createElement("table");
  table.className = "att-list-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Student ID</th>
        <th>Student Name</th>
        <th style="text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody id="attendance-register-entries"></tbody>
  `;
  listContainer.appendChild(table);

  const entriesBody = document.getElementById("attendance-register-entries");

  classStudents.forEach(student => {
    let studentId = student[0];
    let studentName = student[1];

    let preExistingRecord = fullAttendanceLogs.find(
      log => log[0] === activeDate && log[1] === activeSub && log[2] === classId && log[3] === studentId
    );
    let initialStatus = preExistingRecord ? preExistingRecord[4] : "PRESENT";

    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${studentId}</strong></td>
      <td>${studentName}</td>
      <td style="text-align: center;">
        <button type="button" class="att-status-btn ${initialStatus === "PRESENT" ? "present-state" : "absent-state"}" 
                id="att-state-btn-${studentId}" data-status="${initialStatus}">
          ${initialStatus}
        </button>
      </td>
    `;

    const statusBtn = tr.querySelector(`#att-state-btn-${studentId}`);
    statusBtn.addEventListener("click", () => {
      let currentStatus = statusBtn.getAttribute("data-status");
      let nextStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";
      statusBtn.setAttribute("data-status", nextStatus);
      statusBtn.innerText = nextStatus;

      if (nextStatus === "PRESENT") {
        statusBtn.className = "att-status-btn present-state";
      } else {
        statusBtn.className = "att-status-btn absent-state";
      }
    });

    entriesBody.appendChild(tr);
  });
}

function saveFacultyAttendanceRegister() {
  const classId = document.getElementById("att-class-select").value;
  const activeDate = document.getElementById("att-date-picker").value;
  const activeSub = document.getElementById("att-subject-select").value;
  const entriesBody = document.getElementById("attendance-register-entries");

  if (!entriesBody) {
    alert("Generate an active attendance register list before attempting save!");
    return;
  }

  const buttons = entriesBody.querySelectorAll(".att-status-btn");
  let dailyAttendanceLogs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];

  buttons.forEach(btn => {
    let studentId = btn.id.replace("att-state-btn-", "");
    let capturedStatus = btn.getAttribute("data-status");

    // Overwrite update check
    let matchIdx = dailyAttendanceLogs.findIndex(
      log => log[0] === activeDate && log[1] === activeSub && log[2] === classId && log[3] === studentId
    );

    let payload = [
      activeDate,
      activeSub,
      classId,
      studentId,
      capturedStatus,
      activeUserSession.name
    ];

    let recordId = "";
    if (matchIdx > -1) {
      recordId = dailyAttendanceLogs[matchIdx][dailyAttendanceLogs[matchIdx].length - 1];
      payload.push(recordId);
      dailyAttendanceLogs[matchIdx] = payload;
    } else {
      recordId = "REC-ATT-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      payload.push(recordId);
      dailyAttendanceLogs.push(payload);
    }

    let targetTab = sheetTabForKey("DAILY_ATTENDANCE", payload);
    if (targetTab) {
      syncWithGoogleSheet(targetTab, payload, SYSTEM_SCHEMA["DAILY_ATTENDANCE"], "CREATE");
    }
  });

  localStorage.setItem("DAILY_ATTENDANCE", JSON.stringify(dailyAttendanceLogs));
  alert("Daily Attendance Record successfully updated and synchronized!");
}

// 12. STUDENT VIEW PORTAL ENGINE
function renderStudentSelfProfileViewer() {
  const loggedStudentID = activeUserSession.uid;
  const studentsList = JSON.parse(localStorage.getItem("MASTER_STUDENTS")) || [];
  const classesList = JSON.parse(localStorage.getItem("MASTER_CLASSES")) || [];
  const coursesList = JSON.parse(localStorage.getItem("MASTER_COURSES")) || [];
  const attendanceLogs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];

  let studentProfile = studentsList.find(s => s[0] == loggedStudentID);

  if (!studentProfile) {
    document.getElementById("student-profile-section").innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--slate-500);">
         <h3>Error Profile: Linked student account reference not found.</h3>
         <p>Contact Administration Desk to resolve matching system accounts.</p>
      </div>
    `;
    return;
  }

  let classRecord = classesList.find(c => c[0] == studentProfile[2]);
  let courseRecord = coursesList.find(co => co[0] == studentProfile[3]);

  // Update dynamic elements on Profile UI Card
  document.getElementById("p-student-id").innerText = studentProfile[0];
  document.getElementById("p-student-name").innerText = studentProfile[1];
  document.getElementById("p-class-name").innerText = classRecord ? classRecord[1] : studentProfile[2];
  document.getElementById("p-course-name").innerText = courseRecord ? courseRecord[1] : studentProfile[3];
  document.getElementById("p-dob").innerText = studentProfile[4];
  document.getElementById("p-contact").innerText = studentProfile[5];

  // Render attendance metric records
  const studentAttLogs = attendanceLogs.filter(log => log[3] == loggedStudentID);
  const totalSlots = studentAttLogs.length;
  const presentSlots = studentAttLogs.filter(log => log[4] === "PRESENT").length;
  const percentageValue = totalSlots > 0 ? ((presentSlots / totalSlots) * 100).toFixed(1) : "100.0";

  document.getElementById("p-total-days").innerText = totalSlots;
  document.getElementById("p-present-days").innerText = presentSlots;
  document.getElementById("p-absent-days").innerText = totalSlots - presentSlots;
  document.getElementById("p-percentage").innerText = percentageValue + "%";

  // Build custom attendance grid timeline
  const attHistoryBody = document.getElementById("student-att-history-tbody");
  if (attHistoryBody) {
    attHistoryBody.innerHTML = "";
    if (studentAttLogs.length === 0) {
      attHistoryBody.innerHTML = "<tr><td colspan='4' style='text-align: center; color: var(--slate-400);'>No historical logs recorded.</td></tr>";
      return;
    }

    // Sort history by date descending
    studentAttLogs.sort((a,b) => new Date(b[0]) - new Date(a[0]));

    studentAttLogs.forEach(log => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${log[0]}</strong></td>
        <td>${log[1]}</td>
        <td>
          <span style="font-weight: 700; color: ${log[4] === "PRESENT" ? "#166534" : "#991b1b"}">
            ${log[4]}
          </span>
        </td>
        <td>${log[5] || "System Staff"}</td>
      `;
      attHistoryBody.appendChild(tr);
    });
  }
}
