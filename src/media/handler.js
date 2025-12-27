// FILE: src/media/handler.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const r2 = require('../storage/r2.js');

class MediaHandler {
  constructor() {
    this.supportedTypes = {
      image: ['imageMessage'],
      video: ['videoMessage'],
      audio: ['audioMessage', 'pttMessage'],
      document: ['documentMessage'],
      sticker: ['stickerMessage'],
      contact: ['contactMessage', 'contactsArrayMessage'],
      location: ['locationMessage', 'liveLocationMessage'],
      poll: ['pollCreationMessage', 'pollUpdateMessage']
    };
  }

  getMessageType(msg) {
    const message = msg.message;
    if (!message) return { type: 'unknown', subtype: null };

    for (const [type, subtypes] of Object.entries(this.supportedTypes)) {
      for (const subtype of subtypes) {
        if (message[subtype]) return { type, subtype, data: message[subtype] };
      }
    }

    if (message.conversation || message.extendedTextMessage) {
      return { type: 'text', subtype: 'text', data: message.conversation || message.extendedTextMessage?.text };
    }

    return { type: 'unknown', subtype: Object.keys(message)[0] };
  }

  async extractContent(msg, sock) {
    const { type, subtype, data } = this.getMessageType(msg);
    const chatId = msg.key.remoteJid;

    const result = {
      type,
      subtype,
      text: '',
      caption: '',
      mediaUrl: null,
      mediaKey: null,
      mimetype: null,
      filename: null,
      duration: null,
      thumbnail: null,
      location: null,
      contact: null,
      poll: null,
      raw: data
    };

    switch (type) {
      case 'text':
        result.text = typeof data === 'string' ? data : data?.text || '';
        break;

      case 'image':
      case 'video':
      case 'sticker':
        result.caption = data?.caption || '';
        result.mimetype = data?.mimetype;
        result.text = result.caption;
        
        if (r2.isReady()) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            result.mediaUrl = await r2.uploadMedia(buffer, chatId, type, result.mimetype);
            result.mediaKey = result.mediaUrl;
          } catch (e) {
            console.error('Erro download mídia:', e.message);
          }
        }
        break;

      case 'audio':
        result.mimetype = data?.mimetype;
        result.duration = data?.seconds;
        result.text = `[Áudio ${data?.seconds || 0}s]`;
        
        if (r2.isReady()) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            result.mediaUrl = await r2.uploadMedia(buffer, chatId, 'audio', result.mimetype);
            result.mediaKey = result.mediaUrl;
          } catch (e) {
            console.error('Erro download áudio:', e.message);
          }
        }
        break;

      case 'document':
        result.filename = data?.fileName || 'documento';
        result.mimetype = data?.mimetype;
        result.caption = data?.caption || '';
        result.text = `[Documento: ${result.filename}]`;
        
        if (r2.isReady()) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            result.mediaUrl = await r2.uploadMedia(buffer, chatId, 'document', result.mimetype);
            result.mediaKey = result.mediaUrl;
          } catch (e) {
            console.error('Erro download documento:', e.message);
          }
        }
        break;

      case 'contact':
        if (subtype === 'contactsArrayMessage') {
          result.contact = data?.contacts?.map(c => ({
            name: c.displayName,
            vcard: c.vcard
          }));
          result.text = `[Contatos: ${result.contact?.length || 0}]`;
        } else {
          result.contact = [{
            name: data?.displayName,
            vcard: data?.vcard
          }];
          result.text = `[Contato: ${data?.displayName || 'Sem nome'}]`;
        }
        break;

      case 'location':
        result.location = {
          latitude: data?.degreesLatitude,
          longitude: data?.degreesLongitude,
          name: data?.name,
          address: data?.address,
          isLive: subtype === 'liveLocationMessage'
        };
        result.text = `[Localização: ${result.location.name || result.location.address || `${result.location.latitude},${result.location.longitude}`}]`;
        break;

      case 'poll':
        if (subtype === 'pollCreationMessage') {
          result.poll = {
            question: data?.name,
            options: data?.options?.map(o => o.optionName),
            selectableCount: data?.selectableOptionsCount
          };
          result.text = `[Enquete: ${result.poll.question}]`;
        } else {
          result.text = '[Voto em enquete]';
        }
        break;

      default:
        result.text = `[${type}: ${subtype}]`;
    }

    return result;
  }

  parseVCard(vcard) {
    if (!vcard) return null;
    
    const lines = vcard.split('\n');
    const contact = { phones: [], emails: [] };

    for (const line of lines) {
      if (line.startsWith('FN:')) contact.name = line.slice(3).trim();
      if (line.startsWith('TEL')) {
        const phone = line.split(':')[1]?.trim();
        if (phone) contact.phones.push(phone.replace(/\D/g, ''));
      }
      if (line.startsWith('EMAIL')) {
        const email = line.split(':')[1]?.trim();
        if (email) contact.emails.push(email);
      }
      if (line.startsWith('ORG:')) contact.company = line.slice(4).trim();
    }

    return contact;
  }

  async createPoll(sock, chatId, question, options, selectableCount = 1) {
    return sock.sendMessage(chatId, {
      poll: {
        name: question,
        values: options,
        selectableCount
      }
    });
  }

  async sendLocation(sock, chatId, latitude, longitude, name = '', address = '') {
    return sock.sendMessage(chatId, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name,
        address
      }
    });
  }

  async sendContact(sock, chatId, name, phone) {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL:${phone}\nEND:VCARD`;
    return sock.sendMessage(chatId, {
      contacts: {
        displayName: name,
        contacts: [{ vcard }]
      }
    });
  }

  async sendImage(sock, chatId, buffer, caption = '') {
    return sock.sendMessage(chatId, {
      image: buffer,
      caption
    });
  }

  async sendAudio(sock, chatId, buffer, ptt = true) {
    return sock.sendMessage(chatId, {
      audio: buffer,
      mimetype: 'audio/mp4',
      ptt
    });
  }

  async sendDocument(sock, chatId, buffer, filename, mimetype = 'application/octet-stream') {
    return sock.sendMessage(chatId, {
      document: buffer,
      fileName: filename,
      mimetype
    });
  }

  async sendSticker(sock, chatId, buffer) {
    return sock.sendMessage(chatId, {
      sticker: buffer
    });
  }
}

module.exports = new MediaHandler();