
/* =================================
   THIỆP TRI ÂN - CONFIGURATION
================================= */

// Sau này thêm tên ảnh của bạn vào đây.

const IMAGE_LIST = [
    "thiep1.png",
    "thiep2.png",
    "thiep3.png",
    "thiep4.png"
];

const IMAGE_FOLDER = "images/";
const GOOGLE_CLIENT_ID = "705905284135-9iahbm601t5lmbp9pdo1050rhfv2mltg.apps.googleusercontent.com";
const DRIVE_FOLDER_NAME = "ThiepTriAn";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Không random trùng ảnh ở hai lần liên tiếp.
let previousImage = null;

let currentCardURL = null;
let driveAccessToken = null;
let driveTokenExpiresAt = 0;
let driveTokenRequest = null;


/* =================================
   ELEMENTS
================================= */

const form = document.getElementById("greetingForm");

const recipientInput = document.getElementById("recipient");
const senderInput = document.getElementById("sender");
const messageInput = document.getElementById("message");

const cardSection = document.getElementById("cardSection");
const cardImage = document.getElementById("cardImage");
const driveStatus = document.getElementById("driveStatus");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");

const resetBtn = document.getElementById("resetBtn");


/* =================================
   RANDOM IMAGE
================================= */

function randomImage() {

    if (IMAGE_LIST.length === 0) {
        throw new Error("Chưa có hình ảnh trong thư viện.");
    }

    let availableImages = IMAGE_LIST.filter(
        image => image !== previousImage
    );

    if (availableImages.length === 0) {
        availableImages = IMAGE_LIST;
    }

    const selected =
        availableImages[
            Math.floor(Math.random() * availableImages.length)
        ];

    previousImage = selected;

    return IMAGE_FOLDER + selected;
}


/* =================================
   LOAD IMAGE
================================= */

function loadImage(src) {

    return new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => resolve(image);

        image.onerror = () => {
            reject(new Error("Không thể tải hình ảnh: " + src));
        };

        image.src = src;

    });

}

function getDriveAccessToken() {

    if (GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
        return Promise.reject(
            new Error("Hãy cấu hình Google OAuth Client ID trong script.js trước.")
        );
    }

    if (!window.google?.accounts?.oauth2) {
        return Promise.reject(
            new Error("Không tải được dịch vụ đăng nhập Google. Hãy tải lại trang.")
        );
    }

    if (driveAccessToken && Date.now() < driveTokenExpiresAt - 60000) {
        return Promise.resolve(driveAccessToken);
    }

    if (driveTokenRequest) {
        return driveTokenRequest;
    }

    driveTokenRequest = new Promise((resolve, reject) => {
        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: DRIVE_SCOPE,
                callback: response => {
                    driveTokenRequest = null;

                    if (response.error || !response.access_token) {
                        reject(new Error(
                            response.error_description ||
                            response.error ||
                            "Không nhận được quyền truy cập Google Drive."
                        ));
                        return;
                    }

                    driveAccessToken = response.access_token;
                    driveTokenExpiresAt =
                        Date.now() + Number(response.expires_in || 3600) * 1000;
                    resolve(driveAccessToken);
                },
                error_callback: error => {
                    driveTokenRequest = null;
                    reject(new Error(
                        error.message || "Không thể mở cửa sổ đăng nhập Google."
                    ));
                }
            });

            tokenClient.requestAccessToken({ prompt: "" });
        } catch (error) {
            driveTokenRequest = null;
            reject(error);
        }
    });

    return driveTokenRequest;
}

async function driveApiRequest(url, options, accessToken) {

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        let detail = errorBody;

        try {
            const parsedError = JSON.parse(errorBody);
            detail = parsedError.error?.message || errorBody;
        } catch {
            // Giữ nguyên nội dung lỗi nếu phản hồi không phải JSON.
        }

        throw new Error(`Google Drive: ${detail || response.statusText}`);
    }

    return response.json();
}

async function findOrCreateDriveFolder(accessToken) {

    const query = [
        `name = '${DRIVE_FOLDER_NAME}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false"
    ].join(" and ");
    const searchURL = new URL("https://www.googleapis.com/drive/v3/files");
    searchURL.searchParams.set("q", query);
    searchURL.searchParams.set("fields", "files(id,name)");
    searchURL.searchParams.set("pageSize", "100");

    const searchResult = await driveApiRequest(
        searchURL.href,
        { method: "GET" },
        accessToken
    );

    if (searchResult.files.length > 0) {
        return searchResult.files[0].id;
    }

    const folder = await driveApiRequest(
        "https://www.googleapis.com/drive/v3/files",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: DRIVE_FOLDER_NAME,
                mimeType: "application/vnd.google-apps.folder"
            })
        },
        accessToken
    );

    return folder.id;
}

async function saveCardToDrive(blob, sender, recipient, accessToken) {

    const folderId = await findOrCreateDriveFolder(accessToken);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const normalizeName = name => name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const safeSender = normalizeName(sender);
    const safeRecipient = normalizeName(recipient);
    const metadata = {
        name: `${safeSender}-${safeRecipient}-${timestamp}.png`,
        mimeType: "image/png",
        parents: [folderId]
    };
    const boundary = "-------thiepTriAnDriveUpload";
    const body = new Blob([
        `--${boundary}\r\n`,
        "Content-Type: application/json; charset=UTF-8\r\n\r\n",
        JSON.stringify(metadata),
        `\r\n--${boundary}\r\n`,
        "Content-Type: image/png\r\n\r\n",
        blob,
        `\r\n--${boundary}--`
    ]);

    await driveApiRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body
        },
        accessToken
    );
}


/* =================================
   DRAW TEXT
================================= */

function wrapText(text, maxWidth) {

    const words = text.split(/\s+/);

    let line = "";
    const lines = [];

    words.forEach(word => {

        const testLine = line
            ? line + " " + word
            : word;

        const width = ctx.measureText(testLine).width;

        if (width > maxWidth && line) {
            lines.push(line);
            line = word;

        } else {

            line = testLine;

        }

    });

    if (line) {
        lines.push(line);
    }

    return lines;
}

function drawJustifiedText(lines, x, y, maxWidth, lineHeight) {

    const spaceWidth = ctx.measureText(" ").width;

    lines.forEach((line, index) => {

        const words = line.split(/\s+/);
        const lineY = y + lineHeight * (index + 0.5);

        if (index === lines.length - 1 || words.length < 2) {
            ctx.textAlign = "left";
            ctx.fillText(line, x, lineY);
            return;
        }

        const wordsWidth = words.reduce(
            (total, word) => total + ctx.measureText(word).width,
            0
        );
        const gapWidth = (maxWidth - wordsWidth) / (words.length - 1);
        let wordX = x;

        ctx.textAlign = "left";
        words.forEach(word => {
            ctx.fillText(word, wordX, lineY);
            wordX += ctx.measureText(word).width + Math.max(spaceWidth, gapWidth);
        });

    });
}


/* =================================
   CREATE CARD
================================= */

async function createCard(recipient, message, sender) {

    const imagePath = randomImage();

    const image = await loadImage(imagePath);

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    // Vẽ ảnh nền
    ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Vị trí chữ mặc định
    const centerX = canvas.width / 2;

    // Hiệu ứng bóng chữ
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Tên người nhận
    ctx.fillStyle = "#1a1a1a";
    const recipientFontSize = Math.max(24, canvas.width * 0.045);
    ctx.font = `bold ${recipientFontSize}px PalatinoLinotype`;

    // Nội dung lời chúc
    const messageFontSize = Math.max(17, canvas.width * 0.027);
    ctx.font = `${messageFontSize}px Arial`;

    const lineHeight = Math.max(25, canvas.width * 0.04);
    const messageWidth = canvas.width * 0.8 - 100;
    const messageLeft = (canvas.width - messageWidth) / 2;
    const messageLines = wrapText(message, messageWidth);
    const titleHeight = recipientFontSize;
    const titleMessageGap = lineHeight * 0.35;
    const signatureFontSize = Math.max(18, canvas.width * 0.035);
    const signatureLineHeight = signatureFontSize * 1.25;
    const signatureGap = lineHeight * 0.5;
    const signatureBlockHeight = sender
        ? signatureGap + signatureLineHeight * 2
        : 0;
    const textBlockHeight =
        titleHeight + titleMessageGap + messageLines.length * lineHeight +
        signatureBlockHeight;
    const textBlockTop = (canvas.height - textBlockHeight) / 2;

    // Vẽ cả khối chữ ở giữa ảnh.
    ctx.font = `bold ${recipientFontSize}px PalatinoLinotype`;
    ctx.fillText(
        "Kính gửi " + recipient,
        centerX,
        textBlockTop + titleHeight / 2,
        canvas.width * 0.85
    );
    ctx.font = `${messageFontSize}px Arial`;
    ctx.font = `${messageFontSize}px Arial`;
    drawJustifiedText(
        messageLines,
        messageLeft,
        textBlockTop + titleHeight + titleMessageGap,
        messageWidth,
        lineHeight
    );

    if (sender) {
        const signatureRight = canvas.width * 0.92;
        const messageBottom =
            textBlockTop + titleHeight + titleMessageGap +
            messageLines.length * lineHeight;

        ctx.textAlign = "right";
        ctx.font = `italic ${signatureFontSize}px PalatinoLinotype`;
        ctx.fillText(
            "Thân mến,",
            signatureRight,
            messageBottom + signatureGap + signatureLineHeight / 2,
            canvas.width * 0.45
        );

        ctx.font = `bold ${signatureFontSize}px PalatinoLinotype`;
        ctx.fillText(
            sender,
            signatureRight,
            messageBottom + signatureGap + signatureLineHeight * 1.5,
            canvas.width * 0.45
        );
    }

    // Kết thúc hiệu ứng
    ctx.shadowBlur = 0;

    return new Promise((resolve, reject) => {

        canvas.toBlob(blob => {

            if (!blob) {
                reject(new Error("Không thể xuất ảnh thiệp."));
                return;
            }

            if (currentCardURL) {
                URL.revokeObjectURL(currentCardURL);
            }

            currentCardURL = URL.createObjectURL(blob);

            cardImage.src = currentCardURL;

            resolve(blob);

        }, "image/png");

    });

}


/* =================================
   SEND CARD
================================= */

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const recipient = recipientInput.value.trim();
    const sender = senderInput.value.trim();
    const message = messageInput.value.trim();

    if (!recipient || !sender || !message) {
        statusText.textContent = "Vui lòng nhập đầy đủ thông tin.";
        return;
    }

    if (IMAGE_LIST.length === 0) {
        statusText.textContent =
            "Bạn cần thêm ảnh vào thư viện trước khi tạo thiệp.";
        return;
    }

    const sendBtn = document.getElementById("sendBtn");

    sendBtn.disabled = true;
    sendBtn.textContent = "ĐANG KẾT NỐI GOOGLE...";
    statusText.textContent = "Đang chờ bạn cấp quyền truy cập Google Drive...";
    let cardCreated = false;

    try {

        // Bắt đầu OAuth ngay trong thao tác bấm nút để trình duyệt cho phép mở cửa sổ đăng nhập.
        const accessTokenPromise = getDriveAccessToken();
        const accessToken = await accessTokenPromise;

        sendBtn.textContent = "ĐANG TẠO VÀ LƯU THIỆP...";
        const cardBlob = await createCard(recipient, message, sender);
        cardCreated = true;

        form.classList.add("hidden");
        cardSection.classList.remove("hidden");

        form.reset();

        driveStatus.textContent = "Đang lưu thiệp vào Google Drive...";
        await saveCardToDrive(cardBlob, sender, recipient, accessToken);
        driveStatus.textContent =
            `Đã tạo thiệp và lưu vào thư mục “${DRIVE_FOLDER_NAME}” trên Google Drive.`;

    } catch (error) {

        const errorMessage = error instanceof Error
            ? error.message
            : String(error);

        if (cardCreated) {
            driveStatus.textContent =
                `Thiệp đã tạo nhưng không lưu được lên Google Drive: ${errorMessage}`;
        } else {
            statusText.textContent = errorMessage;
        }

    } finally {

        sendBtn.disabled = false;
        sendBtn.textContent = "GỬI THIỆP";

    }

});


/* =================================
   RESET / CREATE AGAIN
================================= */

resetBtn.addEventListener("click", function() {

    form.reset();

    form.classList.remove("hidden");
    cardSection.classList.add("hidden");

    cardImage.removeAttribute("src");
    driveStatus.textContent = "";

    statusText.textContent = "";

    if (currentCardURL) {
        URL.revokeObjectURL(currentCardURL);
        currentCardURL = null;
    }

    recipientInput.focus();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});


/* =================================
   LOAD SHARED CARD
================================= */

async function loadSharedCard() {

    const params = new URLSearchParams(window.location.search);

    const recipient = params.get("recipient");
    const sender = params.get("sender");
    const message = params.get("message");

    if (!recipient || !message || IMAGE_LIST.length === 0) {
        return;
    }

    try {

        await createCard(recipient, message, sender || "");

        form.classList.add("hidden");
        cardSection.classList.remove("hidden");

    } catch (error) {

        statusText.textContent = error.message;

    }

}

loadSharedCard();
