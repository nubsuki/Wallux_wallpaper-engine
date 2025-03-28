

//TO change the background
window.wallpaperPropertyListener = {
    applyUserProperties: function (properties) {
        var videoElement = document.getElementById('bg-video');
        var sourceElement = videoElement.getElementsByTagName('source')[0];

        if (videoElement && sourceElement) {
            if (properties.customvideo) {
                if (properties.customvideo.value) {
                    // If the user has set a video, use it
                    var videoFile = 'file:///' + properties.customvideo.value;
                    sourceElement.src = videoFile;
                } else {
                    // If no video is set, use the default one
                    sourceElement.src = 'default.webm';
                }

                videoElement.load();  // Reload the video
                videoElement.play();  // Start playing
            }
        }

        // Handle element movement setting
        if (properties.enablemovement !== undefined) {
            window.enableElementMovement = properties.enablemovement.value;
        }

        // Handle audio amplification setting
        if (properties.audioamplification !== undefined) {
            window.audioAmplificationFactor = properties.audioamplification.value;
        }

        // Handle blur setting
        if (properties.backgroundblur !== undefined) {
            const blurAmount = properties.backgroundblur.value;
            videoElement.style.filter = `blur(${blurAmount}px)`;
        }
    }
};

let socket;
let reconnectInterval;

function updateStartupText(message) {
    const startupText = document.getElementById('startup-text');
    const startupScreen = document.querySelector('.startup-screen');
    if (startupText) {
        startupText.textContent = message;
    }
}
function showStartupScreen(show) {
    const startupScreen = document.querySelector('.startup-screen');
    startupScreen.style.display = show ? 'flex' : 'none';
}
function connectWebSocket() {
    socket = new WebSocket("ws://localhost:3069/ws");
    showStartupScreen(true);

    socket.onopen = () => {
        updateStartupText("Connected to WebSocket server.");
        // Clear any existing reconnection interval
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        setTimeout(() => {
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                updateStartupText(`Welcome ${data.host_name}!`);
                // Hide startup screen after welcome message
                setTimeout(() => {
                    showStartupScreen(false);
                    setTimeout(() => {
                        showChart();
                        sequentialLoad();
                    }, 100);
                }, 2000);
            };
        }, 5000);
    };

    socket.onerror = (error) => {
        showStartupScreen(true);
        updateStartupText("WebSocket error: Unable to connect to server");
    };


    socket.onclose = () => {

        // Hide all elements when disconnected
        const elements = [
            '.chart-container',
            '.os',
            '#storage-container',
            '.clock-container',
            '.process-container',
            '.music-visualizer',
            '.health-info',
            '.songTitle',
            '.gpuChart-container',
            '.networkChart-container'
        ];

        elements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });

        showStartupScreen(true);
        updateStartupText("Disconnected from WebSocket server. Attempting to reconnect...");
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                updateStartupText("Attempting to reconnect...");
                connectWebSocket();
            }, 5000);
        }
    };
}

// Initial connection
connectWebSocket();

document.addEventListener('DOMContentLoaded', () => {
    initAudioVisualizer();
    initParallaxEffect();
});

function updateDateTime() {
    const now = new Date();

    // Update time
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert to 12-hour format

    const timeSpan = document.querySelector('.time-text span:first-child');
    const ampmSpan = document.querySelector('.time-sub-text');
    timeSpan.textContent = `${displayHours}:${minutes.toString().padStart(2, '0')}`;
    ampmSpan.textContent = ampm;

    // Update date
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();

    // Add ordinal suffix to date
    const ordinal = (date) => {
        if (date > 3 && date < 21) return 'th';
        switch (date % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    updateTimeIcon();
    const dayText = document.querySelector('.day-text');
    dayText.textContent = `${dayName}, ${monthName} ${date}${ordinal(date)}`;
}

function updateTimeIcon() {
    const now = new Date();

    const hours = now.getHours();
    const moonIcon = document.querySelector('.moon');
    const sunIcon = document.querySelector('.sun');

    // Show sun icon between 6 AM and 6 PM (6-18), moon icon otherwise
    if (hours >= 6 && hours < 18) {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }
}

updateDateTime();
setInterval(updateDateTime, 1000);

function showChart() {
    const chartContainer = document.querySelector('.chart-container');
    const os = document.querySelector('.os');
    const storage = document.getElementById('storage-container');
    const clock = document.querySelector('.clock-container');
    const process = document.querySelector('.process-container');
    const musicv = document.querySelector('.music-visualizer');
    const health = document.querySelector('.health-info');
    const song = document.querySelector('.songTitle');
    const gpuContainer = document.querySelector('.gpuChart-container');
    const networkContainer = document.querySelector('.networkChart-container');

    // Initially show loader and hide chart
    clock.style.display = 'block';
    process.style.display = 'block';
    musicv.style.display = 'block';
    health.style.display = 'block';
    song.style.display = 'block';
    chartContainer.style.display = 'block';
    os.style.display = 'block';
    storage.style.display = 'block';

    socket.onmessage = (event) => {


        const data = JSON.parse(event.data);

        // Check GPU detection
        const hasGPU = data.gpu_name && 
                      data.gpu_usage !== undefined && 
                      data.gpu_temp !== undefined &&
                      data.gpu_name !== "GPU not found";

        // Handle GPU container visibility 
        if (!hasGPU) {
            gpuContainer.style.display = 'none';
        } else {
            gpuContainer.style.display = 'block';
        }

        // Update system information
        document.getElementById("statsData").innerHTML = `
        <table>
        <tr>
        <td class="stats">HOST: ${data.host_name}</td>
        <td class="stats">OS: ${data.os_name}</td>
        </tr>
        <tr>
        <td class="stats">Memory: ${data.ram_amount}</td>
        <td class="stats">CPU: ${data.cpu_name.split(' with ')[0]}</td>
        </tr>
        </table>`;

        document.getElementById('process-amount').textContent = `Process: ${data.process_count}`;

        document.getElementById('gpuName').textContent = `${data.gpu_name}`;

        // Update health messages
        document.getElementById('health-mgs').textContent = `System Health: ${data.health.status}`;
        document.getElementById('warning-mgs').innerHTML = data.health.warnings.length > 0 ?
            `<i class="fa-solid fa-triangle-exclamation"></i> ${data.health.warnings.join(', ')}` : '';

        // Update network chart data
        networkChart.data.datasets[0].data.shift(); // Remove oldest download speed
        networkChart.data.datasets[1].data.shift(); // Remove oldest upload speed

        networkChart.data.datasets[0].data.push(parseFloat(data.network_down)); // Add new download speed
        networkChart.data.datasets[1].data.push(parseFloat(data.network_up));   // Add new upload speed

        networkChart.update('none');

        // Update GPU temperature chart
        gpuChart.data.datasets[0].data.shift();
        gpuChart.data.datasets[0].data.push(parseFloat(data.gpu_temp));
        gpuChart.update('none');

        // Update chart data
        currentStats[0].value = parseFloat(data.cpu_usage);    // CPU first
        currentStats[1].value = parseFloat(data.ram_usage);    // RAM second
        currentStats[2].value = hasGPU ? parseFloat(data.gpu_usage) : 0;   // GPU last

        // Update chart
        chart.data.datasets = currentStats.map((stat, index) =>
            createDataset(stat.value, index, currentStats.length)
        );
        chart.update('none');

        // Update legend
        updateLegend();

        // Update disk information
        diskInfo(data.disks);


        document.getElementById("process-Info").innerHTML = `
        <table class="rwd-table">
            <tr>
                <th>PID</th>
                <th>Name</th>
                <th>Usage</th>
            </tr>
            ${data.top_processes.map(process => `
                <tr>
                    <td data-th="PID">${process.pid}</td>
                    <td data-th="Name">${process.name}</td>
                    <td data-th="Usage">${process.cpu_usage.toFixed(1)}% | ${(process.memory_usage / (1024 * 1024)).toFixed(1)} MB</td>
                </tr>
            `).join('')}
        </table>`;
    };
}

// Function to update disk information
function diskInfo(disks) {

    try {
        if (Array.isArray(disks) && disks.length > 0) {
            const storageContainer = document.getElementById('storage-container');
            storageContainer.innerHTML = ''; // Clear existing content

            // Sort the disks array alphabetically by drive letter
            const sortedDisks = [...disks].sort((a, b) => {
                const driveA = a.split('::')[0].trim();
                const driveB = b.split('::')[0].trim();
                return driveA.localeCompare(driveB);
            });

            sortedDisks.forEach((diskString, index) => {
                const diskInfo = diskString.split('::');
                if (diskInfo.length === 2) {
                    const [drive, spaceInfo] = diskInfo;
                    const matches = spaceInfo.match(/(\d+\.?\d*)\s*GB\s*\/\s*(\d+\.?\d*)\s*GB/);

                    if (matches) {
                        const used = parseFloat(matches[1]);
                        const total = parseFloat(matches[2]);
                        const percentage = Math.round((used / total) * 100);

                        // Create drive container
                        const driveElement = document.createElement('div');
                        driveElement.className = 'drive-info';
                        driveElement.innerHTML = `
                            <div class="storage-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 184.4c-17-15.2-39.4-24.4-64-24.4L64 256c-24.6 0-47 9.2-64 24.4L0 96zM64 288l384 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64zM320 416a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm128-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg></div>
                            <div class="info">
                                <div class="disk-total">${drive}::${used} GB/${total} GB</div>
                                <div class="disk-free">${(total - used).toFixed(1)} GB free</div>
                                <div class="progress-bar">
                                    <div class="progress" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `;

                        storageContainer.appendChild(driveElement);
                    }
                }
            });
        } else {
            console.warn("No disk info available:", data.disks);
        }
    } catch (error) {
        console.error("Error parsing disk info:", error);
    }
}

let currentStats = [
    { label: 'CPU', value: 0 },
    { label: 'RAM', value: 0 },
    { label: 'GPU', value: 0 },
];

function createDataset(value, index, total) {
    return {
        data: [value, 100 - value],
        backgroundColor: [
            getComputedStyle(document.documentElement).getPropertyValue(`--color-${index}`),
            'transparent'
        ],
        weight: 1,
        radius: `${85 - (index * 5)}%`,
        rotation: 90,
        circumference: 270
    };
}

// Initialize chart
const ctx = document.getElementById('performanceChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: ['', ''],
        datasets: currentStats.map((stat, index) =>
            createDataset(stat.value, index, currentStats.length)
        )
    },
    options: {
        animation: {
            duration: 0
        },
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        cutout: '60%',
        rotation: 180,
        circumference: 270,
        borderWidth: 1
    }
});

// Create legend
const legendContainer = document.getElementById('statsLegend');
function updateLegend() {
    legendContainer.innerHTML = '';
    currentStats.forEach((stat, index) => {
        const item = document.createElement('div');
        item.className = 'stat-item';
        const color = getComputedStyle(document.documentElement).getPropertyValue(`--color-${index}`);
        item.innerHTML = `
            <span class="stat-color" style="background: ${color}"></span>
            <span>${stat.label}:${Math.round(stat.value)}%</span>
        `;
        legendContainer.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const statsCard = document.getElementById('statsCard');
    const chartCard = document.getElementById('chartCard');

    // Initialize statsCard in minimized state
    statsCard.classList.add('minimized');

    // Add hover events for statsCard only
    statsCard.addEventListener('mouseenter', function () {
        this.classList.remove('minimized');
    });

    statsCard.addEventListener('mouseleave', function () {
        this.classList.add('minimized');
    });
});


const gpuCtx = document.getElementById('gpuChart').getContext('2d');
const gpuChart = new Chart(gpuCtx, {
    type: 'line',
    data: {
        labels: Array(7).fill(''),
        datasets: [{
            label: 'GPU Temperature',
            data: Array(7).fill(0),
            borderColor: 'rgba(255, 255, 255, 0.45)',
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.47)',
                    callback: function (value) {
                        return value + '°C';
                    }
                }
            },
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.7)'
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#ffffff',
                    font: {
                        size: 10,
                        family: 'font2'
                    }
                },
                position: 'bottom',
                align: 'end',
            }
        }
    }
});


const networkCtx = document.getElementById("networkChart").getContext("2d");
const networkChart = new Chart(networkCtx, {
    type: "line",
    data: {
        labels: Array(7).fill(""),
        datasets: [
            {
                label: "Download",
                data: Array(7).fill(0),
                borderColor: "rgba(175, 125, 190, 0.36)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                fill: true,
                tension: 0.4,
            },
            {
                label: "Upload",
                data: Array(7).fill(0),
                borderColor: "rgba(157, 143, 235, 0.36)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                fill: true,
                tension: 0.4,
            },
        ],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: "rgba(255, 255, 255, 0.1)",
                },
                ticks: {
                    color: "rgba(255, 255, 255, 0.7)",
                    callback: function (value) {
                        return value + ' MB/s';
                    }
                }
            },
            x: {
                grid: {
                    color: "rgba(255, 255, 255, 0.1)",
                },
                ticks: {
                    color: "rgba(255, 255, 255, 0.7)",
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: "#ffffff",
                    font: {
                        size: 10,
                        family: 'font2',
                    }
                },
                position: 'bottom',
                align: 'end',
            }
        }
    }
});



// Audio Visualizer Setup
let audioContext;
let analyser;
let dataArray;
const canvas = document.getElementById('AudioCanvas');
const canvasCtx = canvas.getContext('2d');

// Initialize audio visualization
let previousAudioData = new Float32Array(64).fill(0);
let animationFrameId;

// Initialize variables for audio metadata
let currentSongTitle = '';
let currentSongArtwork = '';

function initAudioVisualizer() {
    // Get Wallpaper Engine audio listener for visualizer
    window.wallpaperRegisterAudioListener && window.wallpaperRegisterAudioListener((audioArray) => {
        updateVisualizer(audioArray);
    });

    // Register media properties listener
    window.wallpaperRegisterMediaPropertiesListener && window.wallpaperRegisterMediaPropertiesListener((event) => {
        const songName = document.getElementById('songName');
        const songTitle = document.querySelector('.songTitle');

        if (event.title) {
            songName.textContent = event.title;
            songTitle.style.display = 'flex';
        } else {
            songTitle.style.display = 'none';
        }
    });

    // Register media thumbnail listener
    window.wallpaperRegisterMediaThumbnailListener && window.wallpaperRegisterMediaThumbnailListener((event) => {
        const songImage = document.querySelector('.songTitle img');
        if (event.thumbnail) {
            songImage.src = event.thumbnail;
            songImage.style.display = 'block';
        } else {
            songImage.style.display = 'none';
        }
    });

    // Setup canvas
    canvas.width = 500;
    canvas.height = 100;
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
}

function updateVisualizer(audioArray) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    const barWidth = canvas.width / 64;
    const barSpacing = 2;
    const maxBarHeight = canvas.height - 10;
    const smoothingFactor = 0.3;
    const decayRate = 0.98;
    const amplificationFactor = window.audioAmplificationFactor || 5; // Amplify the audio signal

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    audioArray.forEach((value, index) => {
        // Amplify and smooth the audio data
        const amplifiedValue = Math.min(value * amplificationFactor, 1);
        previousAudioData[index] = previousAudioData[index] * (1 - smoothingFactor) + amplifiedValue * smoothingFactor;

        // Apply decay
        previousAudioData[index] *= decayRate;

        const barHeight = previousAudioData[index] * maxBarHeight;
        const x = index * (barWidth + barSpacing);
        const y = canvas.height - barHeight;

        // Create gradient for bars
        const gradient = canvasCtx.createLinearGradient(0, y, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, y, barWidth, barHeight);
    });

    animationFrameId = requestAnimationFrame(() => updateVisualizer(audioArray));
}

function sequentialLoad() {
    const elements = [
        { el: document.querySelector('.process-containe'), delay: 1000 },
        { el: document.querySelector('.health-info'), delay: 2500 },
        { el: document.querySelector('.clock'), delay: 4000 },
        { el: document.querySelector('.usage-stats'), delay: 5500 },
        { el: document.querySelector('.networkChart-container'), delay: 7000 },
        { el: document.querySelector('.gpuChart-container'), delay: 8500 },
        { el: document.querySelector('.oslayer'), delay: 10000 },
        { el: document.querySelector('.storage-layer'), delay: 11500 },
        { el: document.querySelector('.songTitle'), delay: 13000 },
        { el: document.querySelector('.music-visualizer'), delay: 14500 }
    ];

    // Initially hide all elements
    elements.forEach(({ el }) => {
        if (el) {
            el.style.opacity = '0';
            el.style.display = 'none';
            el.style.animation = 'none';
        }
    });

    // Get the maximum delay
    const maxDelay = Math.max(...elements.map(item => item.delay));

    // Show elements sequentially
    elements.forEach(({ el, delay }) => {
        if (el) {
            setTimeout(() => {
                el.style.display = 'block';
                el.style.opacity = '0';

                void el.offsetWidth;

                el.style.animation = 'tvFlicker 0.8s step-end forwards';
            }, delay);
        }
    });
    setTimeout(() => {
        if (window.enableElementMovement !== false) {
            const gpuContainer = document.querySelector('.gpuChart-container');
            const hasGPU = gpuContainer && gpuContainer.style.display !== 'none';
            updateLocation(hasGPU);
        }
        // Hide process container after 5 seconds
        const processContainer = document.querySelector('.process-container');
        if (processContainer) {
            processContainer.style.opacity = '0';
            setTimeout(() => {
                processContainer.style.display = 'none';
            }, 500);
        }
    }, maxDelay + 1000);
}


function updateLocation(hasGPU) {

        const moveElements = [
            { el: '.clock-container', delay: 0, class: 'clock-move' },
            { el: '.oslayer', delay: 500, class: 'oslayer-move' },
            { el: '.usage-stats', delay: 1000, class: 'usage-stats-move' },
            { el: '.storage-layer', delay: 1500, class: 'storage-layer-move' },
            { el: '.health-info', delay: 2000, class: 'health-info-move' },
            { el: '.gpuChart-container', delay: 2500, class: hasGPU ? 'gpuChart-container-move' : '' },
            { el: '.networkChart-container', delay: 3000, class: hasGPU ? 'networkChart-container-move' : 'networkChart-container-nodetect-move' }
        ];

    moveElements.forEach(({ el, delay, class: className }) => {
        const element = document.querySelector(el);
        if (element) {
            setTimeout(() => {
                // Setup initial transition
                element.style.transition = 'all 0.8s ease-in-out';

                // Wait for fade out to complete
                setTimeout(() => {
                    // Add move class
                    element.classList.add(className);

                    
                }, 800);
            }, delay);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const btnProc = document.querySelector('.btn-proc');
    const processContainer = document.querySelector('.process-container');

    btnProc.addEventListener('click', () => {
        if (processContainer.style.display === 'none') {
            processContainer.style.display = 'block';
            setTimeout(() => {
                processContainer.style.opacity = '1';
            }, 10);
        } else {
            processContainer.style.opacity = '0';
            setTimeout(() => {
                processContainer.style.display = 'none';
            }, 500);
        }
    });
});

function initParallaxEffect() {
    const video = document.getElementById('bg-video');
    const parallaxStrength = 0.02; // Adjust this value to control movement intensity
    const scale = 1.2; // Match the CSS scale value

    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth - 0.5;
        const mouseY = e.clientY / window.innerHeight - 0.5;

        requestAnimationFrame(() => {
            video.style.transform = `translate(-50%, -50%) translate(${mouseX * 20}px, ${mouseY * 20}px) scale(${scale})`;
        });
    });
}
