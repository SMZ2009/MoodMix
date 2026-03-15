/**
 * ShareCardGenerator.js
 * 
 * Utility to generate a premium 3:4 aspect ratio sharing card using Canvas API.
 * Fits the "Mood Alchemy" Oriental aesthetics.
 */

export const generateShareCard = async ({ drink, note, date = new Date(), customImage = null }) => {
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 1600; // 3:4 ratio
    const PADDING = 80;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // 1. Draw Background (Paper Texture / Cream)
    ctx.fillStyle = '#FAF8F5'; // Matches the new background color
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle paper grain (simulated)
    ctx.fillStyle = 'rgba(0,0,0,0.012)';
    for (let i = 0; i < 1200; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = Math.random() * CANVAS_HEIGHT;
        ctx.fillRect(x, y, 1.2, 1.2);
    }

    // 2. Load and Draw Main Image
    const imageUrl = customImage || drink.image;
    try {
        const mainImg = await loadImage(imageUrl);

        // Draw image in a rounded rectangle / frame
        const imgX = PADDING;
        const imgY = PADDING + 130; // Spacing for header
        const imgW = CANVAS_WIDTH - PADDING * 2;
        const imgH = imgW; // Adjusted to 1:1 ratio
        const imageAreaH = imgH; // Square area

        ctx.save();
        roundRect(ctx, imgX, imgY, imgW, imageAreaH, 40); // Larger radius to match detail page
        ctx.clip();

        // Cover fit
        const imgAspect = mainImg.width / mainImg.height;
        const targetAspect = imgW / imageAreaH;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > targetAspect) {
            drawH = imageAreaH;
            drawW = imageAreaH * imgAspect;
            drawX = imgX - (drawW - imgW) / 2;
            drawY = imgY;
        } else {
            drawW = imgW;
            drawH = imgW / imgAspect;
            drawX = imgX;
            drawY = imgY - (drawH - imageAreaH) / 2;
        }

        ctx.drawImage(mainImg, drawX, drawY, drawW, drawH);
        ctx.restore();

        // 3. Draw Brand & Header (Optimized)
        ctx.fillStyle = '#3c3b36';
        ctx.font = 'bold 42px "Songti SC", serif';
        ctx.textAlign = 'left';
        ctx.fillText('MoodMix | 心绪调饮', PADDING, PADDING + 50);

        ctx.fillStyle = '#a09382';
        ctx.font = '22px "Songti SC", serif';
        ctx.fillText('ORIENTAL ALCHEMY', PADDING, PADDING + 85);

        const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
        ctx.textAlign = 'right';
        ctx.font = '32px "FZYouSong", serif';
        ctx.fillText(dateStr, CANVAS_WIDTH - PADDING, PADDING + 60);

        // 4. Draw Drink Name
        const contentY = imgY + imageAreaH + 100;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 84px "Songti SC", serif';
        ctx.fillText(drink.name_cn || drink.name, PADDING, contentY);

        // 5. Emotion & Wuxing (Removed "此刻心迹")
        const tagY = contentY + 65;
        const emotion = drink.dimensions?.mood || '悠然';
        const wuxing = drink.dimensions?.wuxing ? `五行属${drink.dimensions.wuxing}` : '五行调和';

        ctx.fillStyle = '#5c5b56';
        ctx.font = '36px "STKaiti", serif';
        ctx.fillText(`${emotion}  |  ${wuxing}`, PADDING, tagY);

        // Divider
        ctx.strokeStyle = 'rgba(209, 205, 194, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING, tagY + 50);
        ctx.lineTo(PADDING + 100, tagY + 50);
        ctx.stroke();

        // 6. Draw "Symphony" / AI Reason / Quote
        const quoteY = tagY + 140;
        const quoteText = note || drink.reason || '岁序更迭，此情可待';

        // Gallery style left border
        ctx.strokeStyle = '#d1cdc2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(PADDING - 20, quoteY - 40);
        ctx.lineTo(PADDING - 20, quoteY + 120);
        ctx.stroke();

        ctx.fillStyle = '#4c4b46';
        ctx.font = 'italic 38px "STKaiti", serif';
        wrapText(ctx, quoteText, PADDING + 10, quoteY, CANVAS_WIDTH - PADDING * 2 - 40, 60);

        // 7. Footer & QR Area
        const footerY = CANVAS_HEIGHT - PADDING - 40;
        ctx.fillStyle = '#a09382';
        ctx.font = '12px "Songti SC", serif'; // CTAs
        ctx.fillText('扫码试试你的情绪饮品', PADDING, footerY);
        ctx.fillText('SCAN FOR YOUR MOOD MIX', PADDING, footerY + 40);

        // Simulating QR box if needed, but usually generated separately
        return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
        console.error('Failed to generate share card:', error);
        return null;
    }
};

// Helper: Wrap text in Canvas
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n];
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
}

// Helper: Rounded Rectangle
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

// Helper: Load Image with Promise
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}
