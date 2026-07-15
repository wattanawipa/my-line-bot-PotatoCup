const express = require('express');
const line = require('@line/bot-sdk');
const fs = require('fs'); // เพิ่มเข้ามาสำหรับเซฟไฟล์ลงเครื่อง/เซิร์ฟเวอร์
const path = require('path');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// Client สำหรับส่งข้อความและตอบกลับ
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

// 🌟 ตัวดึงไฟล์รูปภาพ/มัลติมีเดีย (Blob) ของ SDK เวอร์ชันใหม่
const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken
});

app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();

  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => console.log('Processed successfully'))
    .catch((err) => {
      console.error('Error handling event:', err);
    });
});

async function handleEvent(event) {
  // เปลี่ยนเงื่อนไข: ยอมให้ event.type === 'message' ผ่านเข้ามาทั้งหมดก่อน
  if (event.type !== 'message') {
    return null;
  }

  const messageType = event.message.type;

  // 1. กรณีคนส่งข้อความตัวอักษร (Text)
  if (messageType === 'text') {
    const userText = event.message.text;
    const echo = { type: 'text', text: `บอทได้รับคำว่า: ${userText}` };
    
    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [echo]
      });
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  }

  // 2. 📸 กรณีคนส่งรูปภาพ (Image) เข้ามาในกลุ่ม
  if (messageType === 'image') {
    const messageId = event.message.id;

    try {
      // ดึงรูปภาพจาก LINE API (ได้มาเป็น Readable Stream)
      const stream = await blobClient.getMessageContent(messageId);
      
      // ตัวอย่างวิธีที่ A: เซฟรูปภาพลงโฟลเดอร์บนเซิร์ฟเวอร์ของคุณ
      const filename = `img_${messageId}.jpg`;
      const savePath = path.join(__dirname, filename);
      const writeStream = fs.createWriteStream(savePath);
      
      stream.pipe(writeStream);

      writeStream.on('finish', async () => {
        console.log(`เซฟรูปภาพสำเร็จที่: ${savePath}`);
        
        // ส่งข้อความบอกในกลุ่มว่าบันทึกรูปแล้ว
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '📷 บอทได้รับและบันทึกรูปภาพเรียบร้อยแล้วครับ!' }]
        });
      });

      /* 
      // ตัวอย่างวิธีที่ B: ถ้าคุณต้องการส่งไฟล์รูปนี้ไปให้ AI (เช่น OpenAI/Gemini) ประมวลผลต่อ
      // ให้แปลง Stream เป็น Buffer/Base64 แบบนี้ครับ
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const imageBuffer = Buffer.concat(chunks);
        const base64Image = imageBuffer.toString('base64');
        // นำ base64Image หรือ imageBuffer ไปยิงส่งให้ AI ต่อได้เลย
      });
      */

    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการดึงรูปภาพ:', err);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

