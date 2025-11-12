/*
SCORM 1.2 API Wrapper
Based on the work of Philip Hutchison, and other contributors.
This is a standard wrapper and should not require modification.
*/

var pipwerks = {}; // pipwerks namespace
pipwerks.UTILS = {}; // UTILS namespace
pipwerks.SCORM = {
  // SCORM namespace
  version: null, // Store SCORM version.
  handle: null, // Store LMS API handle
  isFound: false, // Indicates if the API handle was found
  isInitialized: false, // Indicates if the API has been initialized
  isTerminated: false, // Indicates if the API has been terminated
};
pipwerks.SCORM.API = {
  // SCORM API object
  handle: null,
  isFound: false,
  isInitialized: false,
  isTerminated: false,
  find: function (win) {
    var API = null,
      findAPITries = 0;
    while (
      !API &&
      win.parent &&
      win.parent != win &&
      findAPITries < 500 // Prevent infinite loops
    ) {
      findAPITries++;
      API = win.parent.API;
      win = win.parent;
    }
    return API;
  },
  get: function () {
    var API = this.find(window);
    if (!API && window.opener) {
      API = this.find(window.opener);
    }
    if (API) {
      this.handle = API;
      this.isFound = true;
    } else {
      console.log("SCORM API not found.");
    }
    return API;
  },
  init: function () {
    if (!this.isFound) {
      return false;
    }
    if (this.isInitialized) {
      return true;
    }
    var result = this.handle.LMSInitialize("");
    if (result === "true") {
      this.isInitialized = true;
      return true;
    }
    return false;
  },
  terminate: function () {
    if (!this.isFound || !this.isInitialized || this.isTerminated) {
      return false;
    }
    var result = this.handle.LMSFinish("");
    if (result === "true") {
      this.isTerminated = true;
      return true;
    }
    return false;
  },
  getValue: function (name) {
    if (!this.isFound || !this.isInitialized) {
      return "";
    }
    return this.handle.LMSGetValue(name);
  },
  setValue: function (name, value) {
    if (!this.isFound || !this.isInitialized) {
      return false;
    }
    return this.handle.LMSSetValue(name, value) === "true";
  },
  commit: function () {
    if (!this.isFound || !this.isInitialized) {
      return false;
    }
    return this.handle.LMSCommit("") === "true";
  },
  getLastError: function () {
    if (!this.isFound) {
      return 0;
    }
    return this.handle.LMSGetLastError();
  },
  getErrorString: function (code) {
    if (!this.isFound) {
      return "";
    }
    return this.handle.LMSGetErrorString(code);
  },
  getDiagnostic: function (code) {
    if (!this.isFound) {
      return "";
    }
    return this.handle.LMSGetDiagnostic(code);
  },
};

// Public SCORM 1.2 functions
var scorm = pipwerks.SCORM.API;

function LMSInitialize(param) {
  return scorm.init();
}

function LMSFinish(param) {
  return scorm.terminate();
}

function LMSGetValue(name) {
  return scorm.getValue(name);
}

function LMSSetValue(name, value) {
  return scorm.setValue(name, value);
}

function LMSCommit(param) {
  return scorm.commit();
}

function LMSGetLastError() {
  return scorm.getLastError();
}

function LMSGetErrorString(errorCode) {
  return scorm.getErrorString(errorCode);
}

function LMSGetDiagnostic(errorCode) {
  return scorm.getDiagnostic(errorCode);
}

// Convenience functions
function findAPI(win) {
  if (win.API) return win.API;
  if (win.parent && win.parent != win) return findAPI(win.parent);
  return null;
}

function getAPI() {
  var API = findAPI(window);
  if (!API && window.opener) {
    API = findAPI(window.opener);
  }
  return API;
}

var API = null;

function ScormProcessInitialize() {
  API = getAPI();
  if (API) {
    API.LMSInitialize("");
    return true;
  }
  return false;
}

function ScormProcessFinish() {
  if (API) {
    API.LMSFinish("");
    return true;
  }
  return false;
}

function ScormProcessGetValue(elem, checkError) {
  if (API) {
    var value = API.LMSGetValue(elem);
    if (checkError && API.LMSGetLastError() != "0") {
      return null;
    }
    return value;
  }
  return null;
}

function ScormProcessSetValue(elem, value) {
  if (API) {
    return API.LMSSetValue(elem, value);
  }
  return false;
}

function ScormProcessCommit() {
  if (API) {
    return API.LMSCommit("");
  }
  return false;
}

function ScormProcessGetLastError() {
  if (API) {
    return API.LMSGetLastError();
  }
  return "0";
}

function ScormProcessGetErrorString(code) {
  if (API) {
    return API.LMSGetErrorString(code);
  }
  return "";
}

function ScormProcessGetDiagnostic(code) {
  if (API) {
    return API.LMSGetDiagnostic(code);
  }
  return "";
}

/*
   This script is used to provide a simpler interface to the SCORM API.
   It handles finding the API, initializing, and terminating the connection.
*/

var scormWrapper = {
  init: function () {
    try {
      if (ScormProcessInitialize()) {
        console.log("SCORM connection initialized.");
        // You can set initial values here if needed, for example:
        // ScormProcessSetValue("cmi.core.lesson_status", "incomplete");
        // ScormProcessCommit();
      } else {
        console.log("SCORM API not found. Running in standalone mode.");
      }
    } catch (e) {
      console.error("Error initializing SCORM connection:", e);
    }
  },

  finish: function () {
    try {
      if (ScormProcessFinish()) {
        console.log("SCORM connection finished.");
      }
    } catch (e) {
      console.error("Error finishing SCORM connection:", e);
    }
  },

  setScore: function (raw, min, max) {
    try {
      ScormProcessSetValue("cmi.core.score.raw", raw);
      ScormProcessSetValue("cmi.core.score.min", min);
      ScormProcessSetValue("cmi.core.score.max", max);
      ScormProcessCommit();
      console.log("Score set: raw=" + raw + ", min=" + min + ", max=" + max);
    } catch (e) {
      console.error("Error setting score:", e);
    }
  },

  setLessonStatus: function (status) {
    // status can be: "passed", "completed", "failed", "incomplete", "browsed", "not attempted"
    try {
      ScormProcessSetValue("cmi.core.lesson_status", status);
      ScormProcessCommit();
      console.log("Lesson status set to: " + status);
    } catch (e) {
      console.error("Error setting lesson status:", e);
    }
  },

  getSuspendData: function () {
    try {
      const data = ScormProcessGetValue("cmi.suspend_data");
      console.log("Suspend data retrieved:", data);
      return data || "";
    } catch (e) {
      console.error("Error getting suspend data:", e);
      return "";
    }
  },

  setSuspendData: function (data) {
    try {
      // SCORM 1.2 has a 4096 character limit for suspend_data
      if (data.length > 4096) {
        console.warn("Suspend data is too long for SCORM 1.2 (limit is 4096 characters).");
      }
      ScormProcessSetValue("cmi.suspend_data", data);
      ScormProcessCommit();
      console.log("Suspend data set:", data);
    } catch (e) {
      console.error("Error setting suspend data:", e);
    }
  },

  setSessionTime: function (time) {
    // time should be in format "HH:MM:SS.SS"
    try {
      ScormProcessSetValue("cmi.core.session_time", time);
      ScormProcessCommit();
      console.log("Session time set to: " + time);
    } catch (e) {
      console.error("Error setting session time:", e);
    }
  },
};

// Automatically initialize on window load
window.addEventListener("load", function () {
  scormWrapper.init();
});

// Automatically finish on window unload
window.addEventListener("unload", function () {
  scormWrapper.finish();
});