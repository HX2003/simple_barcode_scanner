document.addEventListener("DOMContentLoaded", function() {
    var worker = null;

    function initWorker() {
        worker = new Worker("wasmWorker.js");
        worker.onmessage = (ev) => terminateWorker(ev.data.data, ev.data.ms);
    }

    const terminateWorker = (data, millis) => {
        worker.terminate();
        video.pause();
        video.srcObject.getVideoTracks().forEach(track => track.stop());
        video.srcObject = null;

        /* handle success for web */
        window.parent.postMessage(data, "*");

        /* handle success for window */
        if (window.chrome.webview != undefined) {
            var param = {
                "methodName": "successCallback",
                "data": data
            }
            window.chrome.webview.postMessage(param);
        }
    };

    const canvas = document.getElementById("canvas");
    const container = document.getElementById("container");

    startVideo();

    var ctx = canvas.getContext('2d');

    var video;
    var oldTime = 0;

    function tick(time) {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            if (canvas.style.transform == "") {
                let scaleAmt = document.body.clientWidth / canvas.width;

                canvas.style.transform = `scale(${scaleAmt})`;
                container.style.height = `${video.videoHeight*scaleAmt}px`;
            }

            ctx.drawImage(video, 0, 0);
            ctx.globalAlpha = 0.6;

            let x = 0;
            let y = 0;
            let w = canvas.width;
            let h = canvas.height;

            if (canvas.width > canvas.height) {
                x = (w - h) / 2;
                w = h;

                ctx.fillRect(0, 0, x, h);
                ctx.fillRect(x + w, 0, x, h);
            } else if (canvas.width < canvas.height) {
                y = (h - w) / 2;
                h = w;

                ctx.fillRect(0, 0, w, y);
                ctx.fillRect(0, y + h, w, y);
            }

            if (time - oldTime > 100) {
                oldTime = time;
                var imageData = ctx.getImageData(x, y, w, h);
                worker.postMessage({
                    data: imageData.data,
                    width: imageData.width,
                    height: imageData.height
                });
            }
        }
        requestAnimationFrame(tick);
    }

    // inspired by https://unpkg.com/browse/scandit-sdk@4.6.1/src/lib/cameraAccess.ts
    const backCameraKeywords = [
        "rear",
        "back",
        "rück",
        "arrière",
        "trasera",
        "trás",
        "traseira",
        "posteriore",
        "后面",
        "後面",
        "背面",
        "后置", // alternative
        "後置", // alternative
        "背置", // alternative
        "задней",
        "الخلفية",
        "후",
        "arka",
        "achterzijde",
        "หลัง",
        "baksidan",
        "bagside",
        "sau",
        "bak",
        "tylny",
        "takakamera",
        "belakang",
        "אחורית",
        "πίσω",
        "spate",
        "hátsó",
        "zadní",
        "darrere",
        "zadná",
        "задня",
        "stražnja",
        "belakang",
        "बैक"
    ];

    function isBackCameraLabel(label) {
        const lowercaseLabel = label.toLowerCase();

        return backCameraKeywords.some(keyword => lowercaseLabel.includes(keyword));
    }

    function selectCamera(devices) {
        if (devices.length == 1) {
            return devices[0].deviceId;
        } else {
            var backDevices = [];
            console.log('Multiple cameras detected:');
            devices.forEach(function(device) {
                console.log(device);

                if (isBackCameraLabel(device.label)) {
                    backDevices.push(device)
                }
            });
            if (backDevices.length == 0) {
                return devices[0].deviceId;
            } else {
                backDevices = backDevices.sort((a, b) => a.label.localeCompare(b.label));
                //Pick the first camera
                return backDevices[0].deviceId;
            }
        }
    }

    async function startVideo() {
        video = document.createElement("video");

        initWorker();

        var stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        });
        var devices = await navigator.mediaDevices.enumerateDevices();
        devices = devices.filter(device => device.kind === "videoinput");
        stream.getTracks().forEach(function(track) {
            track.stop();
        });

        if (devices.length > 0) {
            var deviceId = selectCamera(devices);
            navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    deviceId: deviceId,
                    width: {
                        ideal: 1280
                    },
                    height: {
                        ideal: 720
                    }
                }
            }).then(stream => {
                video.srcObject = stream;
                video.setAttribute("playsinline", "true");
                video.play();
                requestAnimationFrame(tick);
            });
        }
    };
});