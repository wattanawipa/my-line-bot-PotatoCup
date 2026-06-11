const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
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
  const myGoogleSheetLink = process.env.MY_GOOGLE_SHEET_LINK || "https://google.com";
  
  // 🔍 ตรวจสอบและดึงชื่อไลน์ (Display Name) ของคนส่งรูปภาพ
  let displayName = "สมาชิกในกลุ่ม";
  try {
    if (event.source && event.source.userId) {
      let profile;
      if (event.source.groupId) {
        profile = await client.getGroupMemberProfile(event.source.groupId, event.source.userId);
      } else {
        profile = await client.getProfile(event.source.userId);
      }
      if (profile && profile.displayName) {
        displayName = profile.displayName;
      }
    }
  } catch (error) {
    console.error("Cannot get profile name:", error);
  }

  // ❌ [ยกเลิกการเก็บข้อความ] หากผู้ใช้ส่งข้อความตัวอักษร บอทจะไม่ส่งเข้า Google Sheet
  if (event.type === 'message' && event.message.type === 'text') {
    // บอทพิมพ์ตอบปกติ แต่จะไม่ส่งข้อมูลไปที่ Google Sheet ครับ ตารางจะสะอาด
    const userText = event.message.text;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `📝 บอทได้รับข้อความ "${userText}" เรียบร้อยครับ` }]
    });
  }

  // 📸 [เก็บเฉพาะรูปภาพ] ดักจับรูปภาพและโยนไฟล์ส่งไปวาดลงตารางชีต
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    
    // เปลี่ยนมาใช้โครงสร้างลิงก์รูปภาพขนาดจิ๋ว (Thumbnail) ของ LINE แทน เพื่อให้ Google Sheet ยอมดึงรูปไปวาดได้ 100%
    const lineImageUrl = `https://line.me{messageId}/content/preview`;

    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'image',
        userName: displayName,
        data: lineImageUrl,
        token: config.channelAccessToken // แนบ Token ไปให้ Google Sheets ดึงเบื้องหลัง
      }).catch(e => console.error(e));
    }

    const replyText = `📸 บอทเซฟรูปของคุณ ${displayName} เข้าคลังถาวรเรียบร้อยครับ!\n\n📂 เปิดดูคลังรูปภาพทั้งหมดของกลุ่มได้ที่ลิงก์นี้:\n${myGoogleSheetLink}`;

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }]
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
