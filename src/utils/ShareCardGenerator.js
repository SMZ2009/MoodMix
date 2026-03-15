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
    ctx.fillStyle = '#F7F6F2';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle paper grain (simulated)
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = Math.random() * CANVAS_HEIGHT;
        ctx.fillRect(x, y, 2, 2);
    }

    // 2. Load and Draw Main Image
    const imageUrl = customImage || drink.image;
    try {
        const mainImg = await loadImage(imageUrl);

        // Draw image in a rounded rectangle / frame
        const imgX = PADDING;
        const imgY = PADDING + 120;
        const imgW = CANVAS_WIDTH - PADDING * 2;
        const imgH = 600; // Fixed height for image area

        ctx.save();
        roundRect(ctx, imgX, imgY, imgW, imgH, 40);
        ctx.clip();

        // Cover fit
        const imgAspect = mainImg.width / mainImg.height;
        const targetAspect = imgW / imgH;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > targetAspect) {
            drawH = imgH;
            drawW = imgH * imgAspect;
            drawX = imgX - (drawW - imgW) / 2;
            drawY = imgY;
        } else {
            drawW = imgW;
            drawH = imgW / imgAspect;
            drawX = imgX;
            drawY = imgY - (drawH - imgH) / 2;
        }

        ctx.drawImage(mainImg, drawX, drawY, drawW, drawH);
        ctx.restore();

        // 3. Draw Brand & Header
        ctx.fillStyle = '#3c3b36';
        ctx.font = 'bold 36px "Songti SC", serif';
        ctx.textAlign = 'left';
        ctx.fillText('MoodMix | 心绪调饮', PADDING, PADDING + 60);

        // 4. Draw Drink Name
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 72px "Songti SC", serif';
        ctx.fillText(drink.name_cn || drink.name, PADDING, imgY + imgH + 110);

        // 5. Draw "Symphony" / AI Reason
        if (drink.reason) {
            ctx.fillStyle = '#5c5b56';
            ctx.font = 'italic 34px "Songti SC", serif';
            const reasonText = `「${drink.reason}」`;
            wrapText(ctx, reasonText, PADDING, imgY + imgH + 200, CANVAS_WIDTH - PADDING * 2, 54);
        }

        // 6. Draw User Note (if exists)
        const noteYStart = imgY + imgH + 340;
        if (note) {
            ctx.fillStyle = '#2c2b26';
            ctx.font = '40px "STKaiti", serif';
            ctx.fillText('此刻心迹：', PADDING, noteYStart);

            ctx.fillStyle = '#4c4b46';
            ctx.font = '38px "STKaiti", serif';
            wrapText(ctx, note, PADDING, noteYStart + 60, CANVAS_WIDTH - PADDING * 2, 60);
        }

        // 7. Draw Date & Red Seal
        const footerY = CANVAS_HEIGHT - PADDING;
        ctx.fillStyle = '#8c8b86';
        ctx.font = '32px "Songti SC", serif';
        ctx.textAlign = 'left';
        const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillText(dateStr, PADDING, footerY);

        // Red Seal (Simple Circle with Text)
        const sealX = CANVAS_WIDTH - PADDING - 100;
        const sealY = footerY - 50;

        ctx.fillStyle = '#b91c1c'; // Chinese Red
        ctx.beginPath();
        ctx.arc(sealX, sealY, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#F7F6F2';
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px "Songti SC", serif';
        ctx.fillText('Mood', sealX, sealY - 5);
        ctx.fillText('Mix', sealX, sealY + 25);

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
