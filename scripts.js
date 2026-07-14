/* ==========================================================================
   INSTITUTIONAL CORE SYSTEM ENGINE (MODULAR RUNTIME) - OPTIMIZED
   ========================================================================== */

// 1. DYNAMIC DEPLOYMENT CONFIGURATIONS
const DEPLOYMENT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyZJQZVHj3bDl8aHxSxJiDCLN25LnrnG7DtVP9uYYBmkJwLpwLS_VwYFQ7RfPtqeu-L/exec"; 

// 2. RUNTIME DATABASE STATE SCHEMA
const SYSTEM_SCHEMA = {
  MASTER_USERS: ["UID", "Name", "Password", "Role", "RecordID"],
  MASTER_COURSES: ["CourseCode", "CourseName", "Department", "RecordID"],
  MASTER_CLASSES: ["ClassID", "ClassName", "CourseCode", "Department", "RecordID"],
  MASTER_SUBJECTS: ["SubjectCode", "SubjectName", "CourseCode", "Department", "RecordID"],
  MASTER_STAFFS: ["StaffID", "StaffName", "Department", "Contact", "RecordID"],
  // REGISTERING NEW SCHEMA TABLE FOR ALLOCATING SUBJECTS TO STAFF members
  MASTER_ALLOCATIONS: ["StaffID", "ClassID", "SubjectCode", "RecordID"],
  MASTER_STUDENTS: ["StudentID", "StudentName", "ClassID", "CourseCode", "Status", "DOB", "Age", "PrimaryContact", "SecondaryContact", "Std10th", "Std12th", "Accommodation", "HostelName", "RoomNo", "Address", "PhotoURL", "RecordID"],
  CLASS_TIMETABLES: ["ClassID", "Day", "Hour_1", "Hour_2", "Hour_3", "Hour_4", "Hour_5", "Hour_6", "Hour_7", "RecordID"], 
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
  MASTER_ALLOCATIONS: -1,
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

function initializeLocalDatabases() {
  Object.keys(SYSTEM_SCHEMA).forEach(key => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
    }
  });
}

function setupGlobalEvents() {
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

function calculateStudentAgeRuntime() {
  const dobValue = document.getElementById("std-dob").value;
  const ageInput = document.getElementById("std-age");
  if(!dobValue || !ageInput) return;
  
  const birthDate = new Date(dobValue);
  const today = new Date();
  let calculatedAge = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    calculatedAge--;
  }
  ageInput.value = calculatedAge >= 0 ? calculatedAge : 0;
}

function toggleHostelFieldsVisibility() {
  const accommodationType = document.getElementById("std-accom").value;
  const hostelFields = document.querySelectorAll(".hostel-conditional-field");
  hostelFields.forEach(field => {
    if(accommodationType === "Hostel") {
      field.style.display = "flex";
    } else {
      field.style.display = "none";
      const innerInput = field.querySelector("input");
      if(innerInput) innerInput.value = ""; 
    }
  });
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
      if(activeUserSession.role === "STUDENT") {
        renderStudentSelfProfileViewer();
      }
      alert("System database successfully synchronized and refreshed!");
    })
    .catch(err => {
      console.error(err);
      alert("Connection failure with backend server. Check configurations.");
    })
    .finally(() => setGlobalSyncState(false));
}

async function syncWithGoogleSheet(sheetTab, payload, headers, action, recordId = "") {
  if (!DEPLOYMENT_WEB_APP_URL) return;
  
  const requestBody = {
    tabName: sheetTab,       
    action: action,
    payload: payload,
    headers: headers,
    rowId: recordId          
  };

  try {
    let res = await fetch(DEPLOYMENT_WEB_APP_URL, {
      method: "POST",
      mode: "cors",            
      headers: { "Content-Type": "text/plain;charset=utf-8" }, 
      body: JSON.stringify(requestBody)
    });
    let resData = await res.json();
    console.log("Cloud Engine Operations Response:", resData);
  } catch (err) {
    console.warn("Google sheet database synchronization logger exception:", err);
  }
}

function sheetTabForKey(key, optionalRowData = null) {
  const map = {
    MASTER_USERS: "Master_Users",
    MASTER_COURSES: "Master_Courses",
    MASTER_CLASSES: "Master_Classes",
    MASTER_SUBJECTS: "Master_Subjects",
    MASTER_STAFFS: "Master_Staffs",
    MASTER_ALLOCATIONS: "Master_Allocations", // Google Sheet tab name for allocations
    MASTER_STUDENTS: "Master_Students",
    CLASS_TIMETABLES: "Class_Timetables",
    DAILY_ATTENDANCE: "Daily_Class_Attendance"
  };
  return map[key] || "";
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
  const users = JSON.parse(localStorage.getItem("MASTER_USERS")) || [];
  let userRecord = users.find(u => u[0] == uid && u[2] == pass);

  if (userRecord) {
    activeUserSession = { role: userRecord[3], uid: userRecord[0], name: userRecord[1] };
    localStorage.setItem("ACTIVE_SESSION_CACHE", JSON.stringify(activeUserSession));
    applyAuthorizationRules(userRecord[3], userRecord[1]);
  } else if (uid === "admin" && pass === "admin") {
    activeUserSession = { role: "ADMIN", uid: "admin", name: "System Administrator" };
    localStorage.setItem("ACTIVE_SESSION_CACHE", JSON.stringify(activeUserSession));
    applyAuthorizationRules("ADMIN", "System Administrator");
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
  const adminAttType = document.getElementById("admin-att-type-wrapper");

  if (role === "ADMIN") {
    adminMenuOpts.forEach(el => el.style.display = "flex");
    staffMenuOpts.forEach(el => el.style.display = "flex");
    document.getElementById("student-menu-profile").style.display = "none";
    if (adminAttType) adminAttType.style.display = "flex"; // Admin controls event/internship
    document.getElementById("mode-flag-badge").innerText = "ADMINISTRATION INSTANCE";
    triggerNavigationTabChange("dashboard-section");
  } else if (role === "STAFF") {
    adminMenuOpts.forEach(el => el.style.display = "none");
    staffMenuOpts.forEach(el => el.style.display = "flex");
    document.getElementById("student-menu-profile").style.display = "none";
    if (adminAttType) adminAttType.style.display = "none"; // Hide event/internship from staff
    document.getElementById("mode-flag-badge").innerText = "FACULTY PORTAL";
    triggerNavigationTabChange("staff-attendance-section");
  } else if (role === "STUDENT") {
    adminMenuOpts.forEach(el => el.style.display = "none");
    staffMenuOpts.forEach(el => el.style.display = "none");
    document.getElementById("student-menu-profile").style.display = "flex";
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
    if (item.getAttribute("data-target") === tabId) item.classList.add("active");
    else item.classList.remove("active");
  });
  const sections = document.querySelectorAll(".tab-content");
  sections.forEach(s => {
    if (s.id === tabId) s.classList.add("active");
    else s.classList.remove("active");
  });
}

function handleLogout() {
  activeUserSession = { role: "", uid: "", name: "" };
  localStorage.removeItem("ACTIVE_SESSION_CACHE");
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("global-header").style.display = "none";
  document.getElementById("main-sidebar").style.display = "none";
  document.getElementById("main-content-area").style.display = "none";
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

  // New Subject Allocation dynamic bindings
  populateSelectControl("alloc-staff-select", staffList, 1, 0); // Maps staff name/ID
  populateSelectControl("alloc-class-select", classList, 0, 1);
  populateSelectControl("alloc-sub-select", subjectList, 0, 1);

  for (let hourIdx = 1; hourIdx <= 7; hourIdx++) {
    populateSelectControl(`tt-sub-h${hourIdx}`, subjectList, 0, 1, "FREE PERIOD");
    populateSelectControl(`tt-staff1-h${hourIdx}`, staffList, 1, 0, "PRIMARY STAFF");
    populateSelectControl(`tt-staff2-h${hourIdx}`, staffList, 1, 0, "CO-STAFF A (OPTIONAL)");
    populateSelectControl(`tt-staff3-h${hourIdx}`, staffList, 1, 0, "CO-STAFF B (OPTIONAL)");
  }

  // Filter attendance dropdowns immediately if Staff is logged in
  filterSubjectsByAssignedStaff();
}

function populateSelectControl(elementId, dataset, valueColIndex, textColIndex, defaultAlternativeText = null) {
  const selectNode = document.getElementById(elementId);
  if (!selectNode) return;
  selectNode.innerHTML = "";

  let opt = document.createElement("option");
  opt.value = "";
  opt.text = defaultAlternativeText ? defaultAlternativeText : `-- Select Option --`;
  selectNode.appendChild(opt);

  dataset.forEach(row => {
    let opt = document.createElement("option");
    opt.value = row[valueColIndex];
    opt.text = `${row[valueColIndex]} - ${row[textColIndex]}`;
    selectNode.appendChild(opt);
  });
}

// Staff dynamic portal reflection helper
function filterSubjectsByAssignedStaff() {
  const classSelect = document.getElementById("att-class-select");
  const subjectSelect = document.getElementById("att-subject-select");
  if (!classSelect || !subjectSelect) return;

  const selectedClass = classSelect.value;
  const subjectList = JSON.parse(localStorage.getItem("MASTER_SUBJECTS")) || [];
  const allocationsList = JSON.parse(localStorage.getItem("MASTER_ALLOCATIONS")) || [];

  // Default behavior for Admin (No filter required)
  if (activeUserSession.role === "ADMIN") {
    populateSelectControl("att-subject-select", subjectList, 0, 1);
    return;
  }

  // Active Staff portal filtering logic based on Admin's Allocation ledger
  const staffName = activeUserSession.name; 
  if (!selectedClass) {
    subjectSelect.innerHTML = `<option value="">-- Choose Class First --</option>`;
    return;
  }

  // Retrieve assigned subjects allocated specifically to this staff name inside MASTER_ALLOCATIONS[cite: 12]
  let assignedSubjectCodes = [];
  allocationsList.forEach(row => {
    if (row[1] === selectedClass && row[0] === staffName) {
      assignedSubjectCodes.push(row[2]);
    }
  });

  // Unique list of assigned subject codes
  assignedSubjectCodes = [...new Set(assignedSubjectCodes)];

  // Populate only assigned subjects for this faculty
  const filteredSubjects = subjectList.filter(s => assignedSubjectCodes.includes(s[0]));
  populateSelectControl("att-subject-select", filteredSubjects, 0, 1);

  if (filteredSubjects.length === 0) {
    subjectSelect.innerHTML = `<option value="">No Subjects Assigned for you in this class</option>`;
  }
}

// Toggle subject select dropdown if Admin chooses Event / Internship Attendance
function handleAttendanceCategoryToggle() {
  const category = document.getElementById("att-category-select").value;
  const subjectFieldContainer = document.getElementById("subject-field-container");
  
  if (category === "EVENT" || category === "INTERNSHIP") {
    if (subjectFieldContainer) subjectFieldContainer.style.display = "none";
  } else {
    if (subjectFieldContainer) subjectFieldContainer.style.display = "flex";
  }
}

// 8. CRUD SAVE GATEWAY & VALIDATION
function handleFormSubmission(tblKey, inputControlIds, resetFormElementId = null) {
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let formValues = inputControlIds.map(id => {
    let node = document.getElementById(id);
    return node ? node.value.trim() : "";
  });

  if (tblKey === "MASTER_STUDENTS" && document.getElementById("std-accom").value === "Dayscholar") {
    formValues[12] = ""; 
    formValues[13] = ""; 
  }

  let activeIndex = editingRowIndices[tblKey];
  let recordId = "";

  if (activeIndex > -1) {
    let targetRowData = valuesMatrix[activeIndex];
    recordId = targetRowData[targetRowData.length - 1]; 
    formValues.push(recordId);
    valuesMatrix[activeIndex] = formValues;
    editingRowIndices[tblKey] = -1;

    let targetTab = sheetTabForKey(tblKey, formValues);
    if (targetTab) syncWithGoogleSheet(targetTab, formValues, SYSTEM_SCHEMA[tblKey], "UPDATE", recordId);
  } else {
    recordId = "REC-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    formValues.push(recordId);
    valuesMatrix.push(formValues);

    let targetTab = sheetTabForKey(tblKey, formValues);
    if (targetTab) syncWithGoogleSheet(targetTab, formValues, SYSTEM_SCHEMA[tblKey], "CREATE");
  }

  localStorage.setItem(tblKey, JSON.stringify(valuesMatrix));
  renderAllTables();
  refreshFormDropdownLists();

  if (resetFormElementId) {
    document.getElementById(resetFormElementId).reset();
    if(tblKey === "MASTER_STUDENTS") toggleHostelFieldsVisibility();
  }
}

function handleUniversalEdit(tblKey, rowIdx, inputControlIds) {
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let targetRow = valuesMatrix[rowIdx];
  if (!targetRow) return;

  editingRowIndices[tblKey] = rowIdx;
  inputControlIds.forEach((id, idx) => {
    const inputControl = document.getElementById(id);
    if (inputControl) inputControl.value = targetRow[idx] || "";
  });

  if(tblKey === "MASTER_STUDENTS") toggleHostelFieldsVisibility();
  alert("Row parameters successfully bound to UI editors! Edit and commit form.");
}

function handleUniversalDelete(tblKey, rowIdx) {
  if (!confirm("Are you sure you want to permanently delete this record?")) return;
  let valuesMatrix = JSON.parse(localStorage.getItem(tblKey)) || [];
  let targetRowData = valuesMatrix[rowIdx];
  let recordId = targetRowData[targetRowData.length - 1];

  let targetTab = sheetTabForKey(tblKey, targetRowData);
  if (targetTab) syncWithGoogleSheet(targetTab, [], [], "DELETE", recordId);

  valuesMatrix.splice(rowIdx, 1);
  localStorage.setItem(tblKey, JSON.stringify(valuesMatrix));
  renderAllTables();
}

// 9. DYNAMIC GRID & TABLE RENDERERS
function renderAllTables() {
  renderDatasetToTable("user-table-body", "MASTER_USERS", [0, 1, 3], ["UID", "Name", "Role"]);
  renderDatasetToTable("course-table-body", "MASTER_COURSES", [0, 1, 2], ["Course Code", "Course Name", "Dept"]);
  renderDatasetToTable("class-table-body", "MASTER_CLASSES", [0, 1, 2], ["Class ID", "Class Name", "Course Code"]);
  renderDatasetToTable("subject-table-body", "MASTER_SUBJECTS", [0, 1, 2, 3], ["Subject Code", "Subject Name", "Course Code", "Dept"]);
  renderDatasetToTable("staff-table-body", "MASTER_STAFFS", [0, 1, 2, 3], ["Staff ID", "Name", "Dept", "Contact"]);
  renderDatasetToTable("allocation-table-body", "MASTER_ALLOCATIONS", [0, 1, 2], ["Faculty", "Class ID", "Subject Code"]);
  renderDatasetToTable("student-table-body", "MASTER_STUDENTS", [0, 1, 2, 3, 4, 5, 6, 11], ["ID", "Name", "Class", "Course", "Status", "DOB", "Age", "Accom"]);
}

function renderDatasetToTable(tbodyId, tblKey, displayColIndices, headerLabels) {
  const tbodyNode = document.getElementById(tbodyId);
  if (!tbodyNode) return;
  tbodyNode.innerHTML = "";

  const rawDataset = JSON.parse(localStorage.getItem(tblKey)) || [];
  const searchFilterVal = getSearchFilterText(tbodyId);

  rawDataset.forEach((row, originalRowIndex) => {
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

    let actionTd = document.createElement("td");
    actionTd.className = "actions-cell-flex";

    let editBtn = document.createElement("button");
    editBtn.className = "btn-table-edit";
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editBtn.addEventListener("click", () => {
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
    "allocation-table-body": "search-allocations",
    "student-table-body": "search-student"
  };
  const el = document.getElementById(searchInputsMap[tbodyId]);
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
    MASTER_ALLOCATIONS: ["alloc-staff-select", "alloc-class-select", "alloc-sub-select"],
    MASTER_STUDENTS: ["std-id", "std-name", "std-class-select", "std-course-select", "std-status", "std-dob", "std-age", "std-primary", "std-secondary", "std-10th", "std-12th", "std-accom", "std-hostel-name", "std-room", "std-address", "std-photo"],
    CLASS_TIMETABLES: ["tt-class-select", "tt-day-select"]
  };
  return formsMapping[tblKey] || [];
}

// 10. TIMETABLE RUNTIME LAYOUT MATRIX BUILDER - 7 PERIOD CONFIGURATION SUPPORT
function saveTimetableRecord() {
  const classId = document.getElementById("tt-class-select").value;
  const targetDay = document.getElementById("tt-day-select").value;

  if (!classId || !targetDay) {
    alert("Please select Class and Day configurations!");
    return;
  }

  let dynamicPayload = [classId, targetDay];
  for (let hr = 1; hr <= 7; hr++) {
    const subVal = document.getElementById(`tt-sub-h${hr}`).value || "FREE PERIOD";
    const staffVal1 = document.getElementById(`tt-staff1-h${hr}`).value || "";
    const staffVal2 = document.getElementById(`tt-staff2-h${hr}`).value || "";
    const staffVal3 = document.getElementById(`tt-staff3-h${hr}`).value || "";
    
    let combinedStaffs = [staffVal1, staffVal2, staffVal3].filter(s => s !== "").join(" + ");
    if(!combinedStaffs) combinedStaffs = "NO FACULTY ASSIGNED";

    dynamicPayload.push(`${subVal}|${combinedStaffs}`);
  }

  let ttList = JSON.parse(localStorage.getItem("CLASS_TIMETABLES")) || [];
  let existingIndex = ttList.findIndex(row => row[0] === classId && row[1] === targetDay);

  let recordId = existingIndex > -1 ? ttList[existingIndex][ttList[existingIndex].length - 1] : "REC-" + Date.now();
  dynamicPayload.push(recordId);
  
  if (existingIndex > -1) ttList[existingIndex] = dynamicPayload;
  else ttList.push(dynamicPayload);

  localStorage.setItem("CLASS_TIMETABLES", JSON.stringify(ttList));
  renderTimetableGridDisplay();

  let targetTab = sheetTabForKey("CLASS_TIMETABLES");
  if (targetTab) syncWithGoogleSheet(targetTab, dynamicPayload, SYSTEM_SCHEMA["CLASS_TIMETABLES"], "CREATE");
  alert("Timetable Configurations Synchronized!");
}

function renderTimetableGridDisplay() {
  const classId = document.getElementById("tt-class-select").value;
  const gridContainer = document.getElementById("tt-matrix-runtime-grid");
  if (!gridContainer || !classId) return;

  gridContainer.innerHTML = "";
  const ttList = JSON.parse(localStorage.getItem("CLASS_TIMETABLES")) || [];
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

  const timeLabels = [
    "08:45-09:45\n(Period 1)", "09:45-10:45\n(Period 2)", "10:45-11:00\n(BREAK)",
    "11:00-12:00\n(Period 3)", "12:00-01:00\n(Period 4)", "01:00-02:00\n(LUNCH)",
    "02:00-03:00\n(Period 5)", "03:00-03:15\n(BREAK)", "03:15-04:15\n(Period 6)", "04:15-05:16\n(Period 7)"
  ];

  gridContainer.appendChild(createHeaderCell("DAY / TIMINGS"));
  timeLabels.forEach(lbl => gridContainer.appendChild(createHeaderCell(lbl)));

  days.forEach(dayName => {
    let dayRowCell = document.createElement("div");
    dayRowCell.className = "tt-cell tt-day";
    dayRowCell.innerText = dayName;
    gridContainer.appendChild(dayRowCell);

    let mappedDayData = ttList.find(row => row[0] === classId && row[1] === dayName);
    
    let periodTrackingCounter = 1;
    for (let currentSlot = 1; currentSlot <= 10; currentSlot++) {
      if (currentSlot === 3) {
        let breakCell = document.createElement("div");
        breakCell.className = "tt-cell tt-break";
        breakCell.innerText = "BREAK";
        gridContainer.appendChild(breakCell);
        continue;
      }
      if (currentSlot === 6) {
        let lunchBreak = document.createElement("div");
        lunchBreak.className = "tt-cell tt-break";
        lunchBreak.innerText = "LUNCH";
        gridContainer.appendChild(lunchBreak);
        continue;
      }
      if (currentSlot === 8) {
        let breakCell = document.createElement("div");
        breakCell.className = "tt-cell tt-break";
        breakCell.innerText = "BREAK";
        gridContainer.appendChild(breakCell);
        continue;
      }

      let cellValue = mappedDayData ? mappedDayData[periodTrackingCounter + 1] : "";
      let cellNode = document.createElement("div");
      cellNode.className = "tt-cell";

      if (cellValue && cellValue.includes("|")) {
        let [sub, staff] = cellValue.split("|");
        cellNode.innerHTML = `<div class="tt-subject-title">${sub}</div><div class="tt-staff-lbl">${staff}</div>`;
      } else {
        cellNode.innerText = "-";
      }
      gridContainer.appendChild(cellNode);
      periodTrackingCounter++;
    }
  });
}

function createHeaderCell(text) {
  let cell = document.createElement("div");
  cell.className = "tt-header";
  cell.style.whiteSpace = "pre-line";
  cell.innerText = text;
  return cell;
}

// 11. FACULTY ATTENDANCE UTILITY MODULE
async function saveFacultyAttendanceRegister() {
  const classId = document.getElementById("att-class-select").value;
  const activeDate = document.getElementById("att-date-picker").value;
  
  // High-Priority Admin Specific Event & Internship Custom Setup Check
  const attCategorySelect = document.getElementById("att-category-select");
  const currentCategory = attCategorySelect ? attCategorySelect.value : "REGULAR";
  
  let activeSub = "";
  if (currentCategory === "REGULAR") {
    activeSub = document.getElementById("att-subject-select").value;
    if (!activeSub) {
      alert("Please select a subject!");
      return;
    }
  } else {
    // Save under the respective Event/Internship tag for cleaner tracking
    activeSub = currentCategory; 
  }

  const entriesBody = document.getElementById("register-entries");
  if (!entriesBody) return;

  const buttons = entriesBody.querySelectorAll(".att-status-btn");
  let logs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];

  setGlobalSyncState(true);

  for (let btn of buttons) {
    let studentId = btn.id.replace("att-btn-", "");
    let capturedStatus = btn.getAttribute("data-status");

    let matchIdx = logs.findIndex(log => log[0] === activeDate && log[1] === activeSub && log[2] === classId && log[3] === studentId);
    let payload = [activeDate, activeSub, classId, studentId, capturedStatus, activeUserSession.name];
    let recordId = matchIdx > -1 ? logs[matchIdx][logs[matchIdx].length - 1] : "REC-ATT-" + Date.now() + "-" + Math.floor(Math.random()*1000);
    payload.push(recordId);

    if (matchIdx > -1) logs[matchIdx] = payload;
    else logs.push(payload);

    await syncWithGoogleSheet("Daily_Class_Attendance", payload, SYSTEM_SCHEMA["DAILY_ATTENDANCE"], "CREATE");
  }

  localStorage.setItem("DAILY_ATTENDANCE", JSON.stringify(logs));
  setGlobalSyncState(false);
  alert("All student attendance records updated and synchronized!");
}

function generateAttendanceRegisterForm() {
  const classId = document.getElementById("att-class-select").value;
  const activeDate = document.getElementById("att-date-picker").value;
  
  const attCategorySelect = document.getElementById("att-category-select");
  const currentCategory = attCategorySelect ? attCategorySelect.value : "REGULAR";

  let activeSub = "";
  if (currentCategory === "REGULAR") {
    activeSub = document.getElementById("att-subject-select").value;
    if (!classId || !activeDate || !activeSub) {
      alert("Select structural targets first!");
      return;
    }
  } else {
    activeSub = currentCategory;
    if (!classId || !activeDate) {
      alert("Select Class and Date targets first!");
      return;
    }
  }

  const listContainer = document.getElementById("att-students-list-view");
  listContainer.innerHTML = "";
  const studentsList = JSON.parse(localStorage.getItem("MASTER_STUDENTS")) || [];
  const classStudents = studentsList.filter(s => s[2] === classId);

  if (classStudents.length === 0) {
    listContainer.innerHTML = "<p style='padding: 20px;'>No active student indices found.</p>";
    return;
  }

  const fullAttendanceLogs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];
  let table = document.createElement("table");
  table.className = "att-list-table";
  table.innerHTML = `<thead><tr><th>ID</th><th>Name</th><th style='text-align:center;'>Status</th></tr></thead><tbody id="register-entries"></tbody>`;
  listContainer.appendChild(table);

  const entriesBody = document.getElementById("register-entries");
  classStudents.forEach(student => {
    let preExisting = fullAttendanceLogs.find(log => log[0] === activeDate && log[1] === activeSub && log[2] === classId && log[3] === student[0]);
    let status = preExisting ? preExisting[4] : "PRESENT";

    let tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${student[0]}</strong></td><td>${student[1]}</td>
      <td style='text-align:center;'><button type='button' class='att-status-btn ${status === "PRESENT" ? "present-state" : "absent-state"}' id='att-btn-${student[0]}' data-status='${status}'>${status}</button></td>`;
    
    let btn = tr.querySelector(`#att-btn-${student[0]}`);
    btn.addEventListener("click", () => {
      let next = btn.getAttribute("data-status") === "PRESENT" ? "ABSENT" : "PRESENT";
      btn.setAttribute("data-status", next);
      btn.innerText = next;
      btn.className = `att-status-btn ${next === "PRESENT" ? "present-state" : "absent-state"}`;
    });
    entriesBody.appendChild(tr);
  });
}

// 12. STUDENT VIEW PORTAL ENGINE
function renderStudentSelfProfileViewer() {
  const loggedStudentID = activeUserSession.uid;
  const studentsList = JSON.parse(localStorage.getItem("MASTER_STUDENTS")) || [];
  const classesList = JSON.parse(localStorage.getItem("MASTER_CLASSES")) || [];
  const coursesList = JSON.parse(localStorage.getItem("MASTER_COURSES")) || [];
  const attendanceLogs = JSON.parse(localStorage.getItem("DAILY_ATTENDANCE")) || [];

  let profile = studentsList.find(s => s[0] == loggedStudentID);
  if (!profile) return;

  let classRecord = classesList.find(c => c[0] == profile[2]);
  let courseRecord = coursesList.find(co => co[0] == profile[3]);

  document.getElementById("p-student-id").innerText = profile[0];
  document.getElementById("p-student-name").innerText = profile[1];
  document.getElementById("p-class-name").innerText = classRecord ? classRecord[1] : profile[2];
  document.getElementById("p-course-name").innerText = courseRecord ? courseRecord[1] : profile[3];
  document.getElementById("p-status").innerText = profile[4] || "Active";
  document.getElementById("p-dob").innerText = profile[5];
  document.getElementById("p-age").innerText = profile[6];
  document.getElementById("p-primary").innerText = profile[7];
  document.getElementById("p-secondary").innerText = profile[8] || "-";
  document.getElementById("p-marks").innerText = `10th: ${profile[9]}% | 12th: ${profile[10]}%`;
  
  let accomText = profile[11];
  if(accomText === "Hostel") accomText += ` (${profile[12]} - Room ${profile[13]})`;
  document.getElementById("p-accommodation").innerText = accomText;
  document.getElementById("p-address").innerText = profile[14];

  const photoFrame = document.getElementById("p-student-photo-frame");
  if (photoFrame && profile[15]) {
    photoFrame.innerHTML = `<img src="${profile[15]}" alt="Profile Photo">`;
  } else if (photoFrame) {
    photoFrame.innerHTML = `<i class="fas fa-user-graduate"></i>`;
  }

  const studentAttLogs = attendanceLogs.filter(log => log[3] == loggedStudentID);
  const totalSlots = studentAttLogs.length;
  const presentSlots = studentAttLogs.filter(log => log[4] === "PRESENT").length;
  const percentageValue = totalSlots > 0 ? ((presentSlots / totalSlots) * 100).toFixed(1) : "100.0";

  document.getElementById("p-total-days").innerText = totalSlots;
  document.getElementById("p-present-days").innerText = presentSlots;
  document.getElementById("p-absent-days").innerText = totalSlots - presentSlots;
  document.getElementById("p-percentage").innerText = percentageValue + "%";

  const attHistoryBody = document.getElementById("student-att-history-tbody");
  if (attHistoryBody) {
    attHistoryBody.innerHTML = "";
    if (studentAttLogs.length === 0) {
      attHistoryBody.innerHTML = "<tr><td colspan='4' style='text-align: center; color: var(--slate-400);'>No logs.</td></tr>";
      return;
    }
    studentAttLogs.sort((a,b) => new Date(b[0]) - new Date(a[0]));
    studentAttLogs.forEach(log => {
      attHistoryBody.insertAdjacentHTML('beforeend', `<tr><td><strong>${log[0]}</strong></td><td>${log[1]}</td><td><span style="font-weight:700; color:${log[4]==='PRESENT'?'#166534':'#991b1b'}">${log[4]}</span></td><td>${log[5]}</td></tr>`);
    });
  }
}
