// --- Wallpaper Engine Properties ---
window.enableHudMovement = true;

window.wallpaperPropertyListener = {
  applyUserProperties: function (properties) {
    var videoElement = document.getElementById("bg-video");

    if (videoElement && properties.customvideo) {
      var customVal = properties.customvideo.value;
      if (
        customVal &&
        customVal !== "default.webm" &&
        customVal.trim() !== ""
      ) {
        // User selected a custom video
        var videoPath = customVal.replace(/\\/g, "/");
        if (!videoPath.startsWith("file:///")) {
          videoPath = "file:///" + videoPath;
        }
        videoElement.src = videoPath;
      } else {
        // No custom video set reset to default
        videoElement.src = "default.webm";
      }
      videoElement.load();
      videoElement.play().catch(function (e) {
        console.log("Video play caught:", e);
      });
    }

    if (properties.enablehudmovement !== undefined) {
      window.enableHudMovement = properties.enablehudmovement.value;
      const panels = document.querySelectorAll(".hud-panel");
      const procWidget = document.getElementById("process-widget");
      const procToggleBtn = document.getElementById("proc-toggle-btn");

      if (!window.enableHudMovement) {
        // Keep in first place: remove deployed state so all elements remain in their central layout
        panels.forEach((p) => p.classList.remove("hud-deployed"));
        if (procWidget) procWidget.classList.remove("proc-hidden");
        if (procToggleBtn) procToggleBtn.style.display = "none";
      } else if (hasBooted) {
        // Apply deployed layout to operational positions
        const deploymentElements = [
          document.getElementById("clock-widget"),
          document.getElementById("metrics-widget"),
          document.getElementById("disk-container"),
          document.getElementById("network-widget"),
          document.getElementById("health-widget"),
        ].filter(Boolean);
        deploymentElements.forEach((p) => p.classList.add("hud-deployed"));
        if (procWidget) procWidget.classList.add("proc-hidden");
        if (procToggleBtn) procToggleBtn.style.display = "flex";
      }
    }

    if (properties.audioamplification !== undefined) {
      window.audioAmplificationFactor = properties.audioamplification.value;
    }

    if (properties.backgroundblur !== undefined) {
      videoElement.style.filter = `blur(${properties.backgroundblur.value}px)`;
    }
  },
};

// --- Core State & DOM ---
let socket;
let reconnectInterval;
const metricsWidget = document.getElementById("metrics-widget");
const startupScreen = document.getElementById("startup-screen");
const startupText = document.getElementById("startup-text");
const healthBanner = document.getElementById("health-banner");
const healthMessage = document.getElementById("health-message");

function updateStartupText(message) {
  if (startupText) {
    startupText.classList.remove("text-glitch");
    void startupText.offsetWidth; // Trigger reflow for animation restart
    startupText.textContent = message.toUpperCase();
    startupText.classList.add("text-glitch");
  }
}

// --- WebSocket Connection & Boot Sequence ---
let hasBooted = false;

function bootSequence() {
  updateStartupText("Loading system...");
  setTimeout(() => {
    updateStartupText("Initializing HUD components...");
    setTimeout(() => {
      updateStartupText("Establishing secure connection...");
      setTimeout(() => {
        updateStartupText("Waiting for Nekoframe...");
        setTimeout(() => {
          connectWebSocket();
        }, 1500);
      }, 1500);
    }, 1500);
  }, 1500);
}

// --- Active Telemetry Metrics Cache & Matrix Scanner ---
let telemetryState = {
  cpu: 10,
  gpu: 5,
  ram: 40,
  maxTemp: 45,
};

let matrixScannerInterval = null;

function startMatrixTelemetryScanner() {
  if (matrixScannerInterval) return;

  matrixScannerInterval = setInterval(() => {
    const matrix = document.getElementById("cyber-matrix");
    if (!matrix) return;
    const dots = matrix.querySelectorAll(".m-dot");
    if (!dots || dots.length === 0) return;

    // Activity ratio powered by all 3 metrics
    const activityRatio = Math.min(
      Math.max(
        (telemetryState.cpu * 0.45 +
          telemetryState.gpu * 0.35 +
          telemetryState.ram * 0.2) /
          100,
        0.12,
      ),
      0.96,
    );

    dots.forEach((dot) => {
      // Chance of dot being active is directly tied to the 3 combined metrics
      const isLit = Math.random() < activityRatio;
      if (isLit) {
        dot.classList.add("active");
        // Organic micro-fluctuation brightness
        dot.style.opacity = (0.75 + Math.random() * 0.25).toFixed(2);
      } else {
        dot.classList.remove("active");
        dot.style.opacity = "0.15";
      }
    });
  }, 130);
}

function revealDashboard() {
  startupScreen.style.opacity = "0";
  setTimeout(() => {
    startupScreen.style.display = "none";

    const clockWidget = document.getElementById("clock-widget");
    const procWidget = document.getElementById("process-widget");
    const metricsWidgetElem = document.getElementById("metrics-widget");
    const healthWidgetElem = document.getElementById("health-widget");
    const netWidget = document.getElementById("network-widget");
    const diskContainer = document.getElementById("disk-container");
    const musicVizElem = document.getElementById("music-visualizer");

    // Reveal containers
    if (clockWidget) clockWidget.style.display = "flex";
    if (procWidget) procWidget.style.display = "flex";
    if (metricsWidgetElem) {
      metricsWidgetElem.style.display = "flex";
      metricsWidgetElem.style.pointerEvents = "all";
    }
    if (healthWidgetElem) healthWidgetElem.style.display = "flex";
    if (netWidget) netWidget.style.display = "flex";
    if (diskContainer) diskContainer.style.display = "flex";
    if (musicVizElem) musicVizElem.style.display = "flex";

    startMatrixTelemetryScanner();

    // Exact ignition order:
    // 1. Clock -> 2. Process -> 3. Metrics -> 4. Health Matrix -> 5. Network -> 6. Disk -> 7. Audio Visualizer
    const ignitionSequence = [
      clockWidget,
      procWidget,
      metricsWidgetElem,
      healthWidgetElem,
      netWidget,
      diskContainer,
      musicVizElem,
    ].filter(Boolean);

    // Pre-reset elements
    ignitionSequence.forEach((elem) => {
      elem.style.opacity = "0";
      elem.classList.remove("flicker-in");
      elem.classList.remove("hud-deployed");
    });

    // Trigger staggered tube light flicker in exact order
    ignitionSequence.forEach((elem, index) => {
      setTimeout(
        () => {
          elem.classList.add("flicker-in");
        },
        120 + index * 420,
      );
    });

    // Modules to deploy in sequential flight order:
    const deploymentSequence = [
      clockWidget,
      metricsWidgetElem,
      diskContainer,
      netWidget,
      healthWidgetElem,
    ].filter(Boolean);

    if (window.enableHudMovement) {
      // If movement enabled: wait ~1s after ignition, then move modules sequentially one-by-one
      const totalIgnitionTime = 120 + (ignitionSequence.length - 1) * 420 + 950;
      setTimeout(() => {
        deploymentSequence.forEach((elem, idx) => {
          setTimeout(() => {
            elem.classList.add("hud-deployed");
          }, idx * 280);
        });

        // Hide the Process Table and reveal the toggle button
        const postDeployTime = deploymentSequence.length * 280 + 400;
        setTimeout(() => {
          if (procWidget) {
            procWidget.classList.add("proc-hidden");
          }
          const procToggleBtn = document.getElementById("proc-toggle-btn");
          if (procToggleBtn) {
            procToggleBtn.style.display = "flex";
            procToggleBtn.classList.remove("active");
          }
        }, postDeployTime);
      }, totalIgnitionTime);
    }
  }, 800);
}

let dataStreamReady = false;

function connectWebSocket() {
  socket = new WebSocket("ws://localhost:3069/ws");

  socket.onopen = () => {
    updateStartupText("Data stream active...");
    setTimeout(() => {
      dataStreamReady = true;
    }, 1500);

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };

  socket.onerror = () => {
    updateStartupText("Error connecting to Nekoframe...");
  };

  socket.onclose = () => {
    if (metricsWidget) {
      metricsWidget.style.opacity = "0";
      metricsWidget.style.pointerEvents = "none";
    }
    const clockWidget = document.getElementById("clock-widget");
    if (clockWidget) clockWidget.style.display = "none";
    const procWidget = document.getElementById("process-widget");
    if (procWidget) {
      procWidget.style.display = "none";
      procWidget.classList.remove("proc-hidden");
    }
    const procToggleBtn = document.getElementById("proc-toggle-btn");
    if (procToggleBtn) {
      procToggleBtn.style.display = "none";
      procToggleBtn.classList.remove("active");
    }
    const healthWidget = document.getElementById("health-widget");
    if (healthWidget) healthWidget.style.display = "none";
    const netWidget = document.getElementById("network-widget");
    if (netWidget) netWidget.style.display = "none";
    const diskContainer = document.getElementById("disk-container");
    if (diskContainer) diskContainer.style.display = "none";
    const musicViz = document.getElementById("music-visualizer");
    if (musicViz) musicViz.style.display = "none";
    const panels = document.querySelectorAll(".hud-panel");
    panels.forEach((p) => {
      p.classList.remove("flicker-in");
      p.classList.remove("hud-deployed");
    });
    startupScreen.style.display = "flex";
    setTimeout(() => (startupScreen.style.opacity = "1"), 10);
    updateStartupText("Disconnected. Attempting to reconnect...");
    hasBooted = false; // Reset boot flag on disconnect
    dataStreamReady = false;

    if (!reconnectInterval) {
      reconnectInterval = setInterval(connectWebSocket, 5000);
    }
  };

  socket.onmessage = (event) => {
    if (!dataStreamReady) return;

    const data = JSON.parse(event.data);

    if (!hasBooted && data.username) {
      hasBooted = true;
      updateStartupText(`Welcome ${data.username}`);
      setTimeout(revealDashboard, 1500);
    }

    processNekoframeData(data);
  };
}

function updateHazardStripes(containerId, percentage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const spans = container.querySelectorAll("span");
  const total = spans.length;
  const activeCount = (percentage / 100) * total;

  spans.forEach((span, index) => {
    if (index < Math.floor(activeCount)) {
      span.classList.add("active");
      span.style.opacity = "1";
    } else if (index === Math.floor(activeCount)) {
      const remainder = activeCount - Math.floor(activeCount);
      if (remainder > 0.05) {
        span.classList.add("active");
        span.style.opacity = (0.18 + remainder * 0.82).toFixed(2);
      } else {
        span.classList.remove("active");
        span.style.opacity = "0.18";
      }
    } else {
      span.classList.remove("active");
      span.style.opacity = "0.18";
    }
  });
}

// --- Data Processing ---
function processNekoframeData(data) {
  // System Info
  const sysNameElem = document.getElementById("sys-name");
  if (sysNameElem) sysNameElem.textContent = data.system_name || "PC";
  const sysUserElem = document.getElementById("sys-user");
  if (sysUserElem) sysUserElem.textContent = data.username || "User";

  // CPU Metrics
  if (data.cpu) {
    const nameCpu = document.getElementById("name-cpu");
    if (nameCpu) nameCpu.textContent = data.cpu.name.split(" ")[0] || "CPU";
    const cpuUsage = data.cpu.usage_percent || 0;
    const textCpu = document.getElementById("text-cpu");
    if (textCpu) textCpu.textContent = Math.round(cpuUsage) + "%";
    const tempCpu = document.getElementById("temp-cpu");
    if (tempCpu)
      tempCpu.textContent = data.cpu.temp_celsius
        ? Math.round(data.cpu.temp_celsius) + "°C"
        : "--";
    updateHazardStripes("stripes-cpu", cpuUsage);
    telemetryState.cpu = cpuUsage;
  }

  // GPU Metrics
  if (data.gpu) {
    const nameGpu = document.getElementById("name-gpu");
    if (nameGpu) nameGpu.textContent = data.gpu.name.split(" ")[0] || "GPU";
    const gpuUsage = data.gpu.usage_percent || 0;
    const textGpu = document.getElementById("text-gpu");
    if (textGpu) textGpu.textContent = Math.round(gpuUsage) + "%";
    const tempGpu = document.getElementById("temp-gpu");
    const gpuTemp = data.gpu.temp_celsius || 0;
    if (tempGpu)
      tempGpu.textContent = gpuTemp ? Math.round(gpuTemp) + "°C" : "--";
    updateHazardStripes("stripes-gpu", gpuUsage);
    telemetryState.gpu = gpuUsage;

    // GPU Fan Telemetry & Blade Animation
    let fanRpm = 0;
    let fanPercent = 0;

    if (data.fans && data.fans.length > 0) {
      const gpuFan =
        data.fans.find(
          (f) =>
            f.name.toLowerCase().includes("gpu") ||
            f.name.toLowerCase().includes("fan"),
        ) || data.fans[0];
      if (gpuFan && gpuFan.rpm > 0) {
        fanRpm = Math.round(gpuFan.rpm);
        fanPercent = Math.min(100, Math.round((fanRpm / 2400) * 100));
      }
    }

    if (fanRpm === 0) {
      if (gpuTemp >= 50 || gpuUsage >= 15) {
        fanPercent = Math.min(
          100,
          Math.max(30, Math.round(30 + ((gpuTemp - 50) / 35) * 70)),
        );
        fanRpm = Math.round((fanPercent / 100) * 2200);
      } else {
        fanPercent = 0;
        fanRpm = 0;
      }
    }

    const rpmElem = document.getElementById("gpu-fan-rpm");
    if (rpmElem) rpmElem.textContent = `${fanRpm} RPM`;

    const fanPctElem = document.getElementById("gpu-fan-percent");
    if (fanPctElem) fanPctElem.textContent = `${fanPercent}%`;

    const fanStatusElem = document.getElementById("gpu-fan-status");
    if (fanStatusElem) {
      if (fanRpm > 0) {
        fanStatusElem.textContent =
          fanPercent > 75 ? "MAX COOLING" : "COOLING ACTIVE";
      } else {
        fanStatusElem.textContent = "ZERO RPM MODE";
      }
    }

    // Dynamically throttle fan blade spin speed to RPM
    const blade1 = document.getElementById("gpu-fan-blade-1");
    const blade2 = document.getElementById("gpu-fan-blade-2");
    if (blade1 && blade2) {
      if (fanRpm > 0) {
        const spinDuration =
          Math.max(0.2, 2.0 - (fanPercent / 100) * 1.7).toFixed(2) + "s";
        blade1.style.animationPlayState = "running";
        blade1.style.animationDuration = spinDuration;
        blade2.style.animationPlayState = "running";
        blade2.style.animationDuration = spinDuration;
      } else {
        blade1.style.animationPlayState = "paused";
        blade2.style.animationPlayState = "paused";
      }
    }
  }

  // RAM Metrics
  if (data.ram) {
    const usedGb = data.ram.used_gb;
    const totalGb = data.ram.total_gb;
    const ramPercent = totalGb > 0 ? (usedGb / totalGb) * 100 : 0;
    const textRam = document.getElementById("text-ram");
    if (textRam) textRam.textContent = Math.round(ramPercent) + "%";
    const valRam = document.getElementById("val-ram");
    if (valRam)
      valRam.textContent = `${usedGb.toFixed(1)} / ${totalGb.toFixed(0)} GB`;
    updateHazardStripes("stripes-ram", ramPercent);
    telemetryState.ram = ramPercent;
  }

  // Network Metrics (Download & Upload)
  if (data.network) {
    const dlKbps = data.network.download_kbps || 0;
    const upKbps = data.network.upload_kbps || 0;

    const formatNetSpeed = (kbps) => {
      const val = kbps || 0;
      if (val >= 1024 * 1024) {
        return (val / (1024 * 1024)).toFixed(1) + " GB/s";
      }
      if (val >= 1024) {
        return (val / 1024).toFixed(1) + " MB/s";
      }
      return Math.round(val) + " KB/s";
    };

    const netDlSpeed = document.getElementById("net-dl-speed");
    if (netDlSpeed) netDlSpeed.textContent = formatNetSpeed(dlKbps);

    const netUpSpeed = document.getElementById("net-up-speed");
    if (netUpSpeed) netUpSpeed.textContent = formatNetSpeed(upKbps);

    const dlTriangles = document.getElementById("net-dl-triangles");
    const upTriangles = document.getElementById("net-up-triangles");

    if (dlTriangles) {
      if (dlKbps > 5) {
        dlTriangles.classList.add("active");
        const dur =
          Math.max(0.2, 0.7 - Math.min(dlKbps / 5000, 0.5)).toFixed(2) + "s";
        dlTriangles
          .querySelectorAll(".dl-poly")
          .forEach((p) => (p.style.animationDuration = dur));
      } else {
        dlTriangles.classList.remove("active");
      }
    }

    if (upTriangles) {
      if (upKbps > 5) {
        upTriangles.classList.add("active");
        const dur =
          Math.max(0.2, 0.7 - Math.min(upKbps / 5000, 0.5)).toFixed(2) + "s";
        upTriangles
          .querySelectorAll(".up-poly")
          .forEach((p) => (p.style.animationDuration = dur));
      } else {
        upTriangles.classList.remove("active");
      }
    }
  }

  // Disk Telemetry
  if (data.disks && data.disks.length > 0) {
    const diskContainer = document.getElementById("disk-container");
    if (diskContainer) {
      diskContainer.innerHTML = data.disks
        .slice(0, 3)
        .map((d, i) => {
          const used = d.used_gb ? d.used_gb.toFixed(1) : "0";
          const total = d.total_gb ? d.total_gb.toFixed(0) : "0";
          const pct = Math.min(
            100,
            Math.max(
              0,
              Math.round(
                d.usage_percent ||
                  (d.total_gb > 0 ? (d.used_gb / d.total_gb) * 100 : 0),
              ),
            ),
          );
          const driveLetter = (d.name || `C:`).toUpperCase().replace(/\\$/, "");

          // Check direct temp or correlate with data.storage sensor
          let temp = d.temp_celsius;
          if (
            (temp === undefined || temp === null) &&
            data.storage &&
            data.storage[i]
          ) {
            temp = data.storage[i].temp_celsius;
          }
          const tabTemp =
            temp !== undefined && temp !== null && temp > 0
              ? `<span class="disk-tab-temp">${Math.round(temp)}°C</span>`
              : "";

          return `
                <div class="disk-card" id="disk-card-${i}">
                    <div class="disk-header-row">
                        <span class="disk-title">DISK <span class="disk-name">${driveLetter}</span></span>
                        <span class="disk-val">${used} / ${total} GB</span>
                    </div>
                    <div class="disk-stepped-track">
                        <svg class="disk-shape-svg" viewBox="0 0 160 22" preserveAspectRatio="none">
                            <defs>
                                <clipPath id="disk-clip-${i}">
                                    <path d="M 0 6 L 6 0 L 52 0 L 64 8 L 152 8 L 160 14 L 160 22 L 0 22 Z" />
                                </clipPath>
                            </defs>
                            <path class="disk-shape-bg" d="M 0 6 L 6 0 L 52 0 L 64 8 L 152 8 L 160 14 L 160 22 L 0 22 Z" />
                            <g clip-path="url(#disk-clip-${i})">
                                <rect class="disk-shape-fill" x="0" y="0" width="${pct}%" height="22" />
                            </g>
                            <path class="disk-shape-border" d="M 0 6 L 6 0 L 52 0 L 64 8 L 152 8 L 160 14 L 160 22 L 0 22 Z" />
                        </svg>
                        <span class="disk-tab-text">${driveLetter} ${tabTemp}</span>
                        <span class="disk-percent-text">${pct}%</span>
                    </div>
                </div>
                `;
        })
        .join("");
    }
  }

  // Process List
  const procContainer = document.getElementById("process-container");
  const procCountElem = document.getElementById("process-count");
  if (procCountElem) {
    procCountElem.textContent =
      data.process_count ||
      (data.top_processes ? data.top_processes.length : 0);
  }

  if (data.top_processes && data.top_processes.length > 0) {
    procContainer.innerHTML = data.top_processes
      .slice(0, 10)
      .map((proc) => {
        const mb = (proc.memory_usage / (1024 * 1024)).toFixed(1);
        const cpu = (proc.cpu_usage || 0).toFixed(1);
        return `
                <div class="proc-row">
                    <span class="col-pid">${proc.pid || "--"}</span>
                    <span class="col-name" title="${proc.name}">${proc.name}</span>
                    <span class="col-usage">${cpu}% | ${mb} MB</span>
                </div>
            `;
      })
      .join("");
  }

  // Health Evaluation & Alerts
  const maxTemp = Math.max(
    data.cpu?.temp_celsius || 0,
    data.gpu?.temp_celsius || 0,
  );
  const avgLoad =
    ((data.cpu?.usage_percent || 0) +
      (data.gpu?.usage_percent || 0) +
      (data.ram && data.ram.total_gb > 0
        ? (data.ram.used_gb / data.ram.total_gb) * 100
        : 0)) /
    3;

  const healthWidgetElem = document.getElementById("health-widget");
  const healthVerticalText = document.getElementById("health-vertical-text");

  if (maxTemp > 85) {
    if (healthVerticalText) {
      healthVerticalText.textContent = "SYSTEM: WARNING";
      healthVerticalText.style.color = "#ef4444";
      healthVerticalText.style.textShadow = "0 0 8px rgba(239, 68, 68, 0.9)";
    }
    if (healthWidgetElem) {
      healthWidgetElem.classList.add("status-warning");
      healthWidgetElem.classList.remove("status-heavy");
    }
  } else if (avgLoad > 75) {
    if (healthVerticalText) {
      healthVerticalText.textContent = "SYSTEM: HEAVY";
      healthVerticalText.style.color = "#ffffff";
      healthVerticalText.style.textShadow = "0 0 8px rgba(255, 255, 255, 0.9)";
    }
    if (healthWidgetElem) {
      healthWidgetElem.classList.remove("status-warning");
      healthWidgetElem.classList.add("status-heavy");
    }
  } else {
    if (healthVerticalText) {
      healthVerticalText.textContent = "SYSTEM: HEALTHY";
      healthVerticalText.style.color = "#ffffff";
      healthVerticalText.style.textShadow = "0 0 8px rgba(255, 255, 255, 0.9)";
    }
    if (healthWidgetElem) {
      healthWidgetElem.classList.remove("status-warning", "status-heavy");
    }
  }

  let warnings = [];
  if (data.cpu && data.cpu.temp_celsius > 90)
    warnings.push(
      `CPU is overheating (${Math.round(data.cpu.temp_celsius)}°C)`,
    );
  if (data.gpu && data.gpu.temp_celsius > 85)
    warnings.push(
      `GPU is overheating (${Math.round(data.gpu.temp_celsius)}°C)`,
    );

  if (warnings.length > 0) {
    healthBanner.style.display = "flex";
    healthMessage.textContent = warnings.join(" | ");
  } else {
    healthBanner.style.display = "none";
  }
}

// --- Clock ---
function updateDateTime() {
  const now = new Date();

  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  document.getElementById("time-hours").textContent = hours;
  document.getElementById("time-minutes").textContent = minutes
    .toString()
    .padStart(2, "0");
  document.getElementById("time-ampm").textContent = ampm;

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const date = now.getDate();
  const ordinal = (d) => {
    if (d > 3 && d < 21) return "TH";
    switch (d % 10) {
      case 1:
        return "ST";
      case 2:
        return "ND";
      case 3:
        return "RD";
      default:
        return "TH";
    }
  };

  document.getElementById("day-text").textContent =
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${date}${ordinal(date)}`.toUpperCase();

  const h24 = now.getHours();
  if (h24 >= 6 && h24 < 18) {
    document.getElementById("icon-sun").style.display = "block";
    document.getElementById("icon-moon").style.display = "none";
  } else {
    document.getElementById("icon-sun").style.display = "none";
    document.getElementById("icon-moon").style.display = "block";
  }
}
setInterval(updateDateTime, 1000);
updateDateTime();

// --- Audio Visualizer (Optimized 30 FPS) ---
const canvas = document.getElementById("AudioCanvas");
const canvasCtx = canvas.getContext("2d");
let previousAudioData = new Float32Array(64).fill(0);
let lastDrawTime = 0;
let visualizerData = null;

function initAudioVisualizer() {
  canvas.width = 440;
  canvas.height = 48;

  window.wallpaperRegisterAudioListener &&
    window.wallpaperRegisterAudioListener((audioArray) => {
      visualizerData = audioArray;
    });

  window.wallpaperRegisterMediaPropertiesListener &&
    window.wallpaperRegisterMediaPropertiesListener((event) => {
      const songInfo = document.getElementById("song-info");
      if (event.title) {
        document.getElementById("song-name").textContent =
          event.title + (event.artist ? ` - ${event.artist}` : "");
        songInfo.style.display = "flex";
      } else {
        songInfo.style.display = "none";
      }
    });

  window.wallpaperRegisterMediaThumbnailListener &&
    window.wallpaperRegisterMediaThumbnailListener((event) => {
      const img = document.getElementById("song-image");
      if (img) {
        img.onload = () => {
          img.style.display = "block";
        };
        img.onerror = () => {
          img.removeAttribute("src");
          img.style.display = "none";
        };

        if (
          event &&
          event.thumbnail &&
          typeof event.thumbnail === "string" &&
          event.thumbnail.trim() !== ""
        ) {
          img.src = event.thumbnail;
        } else {
          img.removeAttribute("src");
          img.style.display = "none";
        }
      }
    });

  window.wallpaperRegisterMediaPlaybackListener &&
    window.wallpaperRegisterMediaPlaybackListener((event) => {
      const isStopped =
        (window.wallpaperMediaIntegration &&
          event.state === window.wallpaperMediaIntegration.PLAYBACK_STOPPED) ||
        event.state === 0;

      if (isStopped) {
        const songInfo = document.getElementById("song-info");
        const img = document.getElementById("song-image");
        if (songInfo) songInfo.style.display = "none";
        if (img) {
          img.removeAttribute("src");
          img.style.display = "none";
        }
      }
    });

  requestAnimationFrame(renderVisualizer);
}

function renderVisualizer(timestamp) {
  requestAnimationFrame(renderVisualizer);

  // Throttle to 30fps to save GPU/CPU load
  if (timestamp - lastDrawTime < 33) return;
  lastDrawTime = timestamp;

  if (!visualizerData) return;

  const barWidth = canvas.width / 64;
  const barSpacing = 2;
  const amplification = window.audioAmplificationFactor || 4;
  const smoothing = 0.4;
  const decay = 0.95;

  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Pure glowing neon white gradient
  const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.25)");
  canvasCtx.fillStyle = gradient;

  for (let i = 0; i < 64; i++) {
    const val = Math.min(visualizerData[i] * amplification, 1);
    previousAudioData[i] =
      previousAudioData[i] * (1 - smoothing) + val * smoothing;
    previousAudioData[i] *= decay;

    const h = previousAudioData[i] * canvas.height;
    const x = i * (barWidth + barSpacing);
    const y = canvas.height - h;

    canvasCtx.fillRect(x, y, barWidth, h);
  }
}

// --- Parallax Effect ---
document.addEventListener("mousemove", (e) => {
  const video = document.getElementById("bg-video");
  if (!video) return;
  const mouseX = e.clientX / window.innerWidth - 0.5;
  const mouseY = e.clientY / window.innerHeight - 0.5;
  video.style.transform = `translate(${mouseX * 10}px, ${mouseY * 10}px) scale(1.03)`;
});

// --- Process Monitor Toggle Handler ---
function initProcessToggle() {
  const procToggleBtn = document.getElementById("proc-toggle-btn");
  const procWidget = document.getElementById("process-widget");
  if (!procToggleBtn || !procWidget) return;

  procToggleBtn.addEventListener("click", () => {
    const isHidden = procWidget.classList.contains("proc-hidden");
    if (isHidden) {
      procWidget.classList.remove("proc-hidden");
      procToggleBtn.classList.add("active");
    } else {
      procWidget.classList.add("proc-hidden");
      procToggleBtn.classList.remove("active");
    }
  });
}

// Boot
initAudioVisualizer();
initProcessToggle();
bootSequence();
