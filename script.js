
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

// Không random trùng ảnh ở hai lần liên tiếp.
let previousImage = null;

let currentCardURL = null;


/* =================================
   ELEMENTS
================================= */

const form = document.getElementById("greetingForm");

const recipientInput = document.getElementById("recipient");
const senderInput = document.getElementById("sender");
const messageInput = document.getElementById("message");

const cardSection = document.getElementById("cardSection");
const cardImage = document.getElementById("cardImage");

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

    return new Promise(resolve => {

        canvas.toBlob(blob => {

            if (!blob) {
                throw new Error("Không thể xuất ảnh thiệp.");
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
    sendBtn.textContent = "ĐANG TẠO THIỆP...";

    try {

        await createCard(recipient, message, sender);

        form.classList.add("hidden");
        cardSection.classList.remove("hidden");

        form.reset();

        statusText.textContent = "Đã tạo thiệp thành công!";

    } catch (error) {

        statusText.textContent = error.message;

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
