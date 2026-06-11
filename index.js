const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// เชื่อมต่อ Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken
});

app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => console.log('Processed successfully'))
    .catch((err) => console.error('Error:', err));
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `บอทได้รับคำว่า: ${userText}` }]
    });
  }

  // ดักจับรูปภาพแล้วส่งเข้า Supabase
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    const fileName = `${Date.now()}_${messageId}.jpg`; // ตั้งชื่อไฟล์ไม่ให้ซ้ำกัน

    try {
      // 1. ดึงรูปจาก LINE
      const response = await blobClient.getMessageContent(messageId);
      const chunks = [];
      for await (const chunk of response) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 2. อัปโหลดขึ้น Supabase Storage
      const { data, error } = await supabase.storage
        .from('line-images')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      // 3. ดึงลิงก์รูปภาพสาธารณะที่ไม่มีวันหมดอายุ
      const { data: { publicUrl } } = supabase.storage
        .from('line-images')
        .getPublicUrl(fileName);

      // 4. ส่งลิงก์กลับไปในกลุ่ม LINE
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ 
          type: 'text', 
          text: `📸 เซฟรูปลงคลังส่วนตัวฟรีตลอดชีพเรียบร้อยครับ!\nลิงก์ดูรูป:\n${publicUrl}` 
        }]
      });

    } catch (err) {
      console.error('Failed to save image to Supabase:', err);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
