const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

require('dotenv').config();

// ==================== الإعدادات ====================
const CONFIG = {
    TOKEN: process.env.TOKEN,
    GUILD_ID: process.env.GUILD_ID,
    TICKET_ADMIN_ROLE_ID: '1489328798506815682',
    BLACKLIST_LOG_CHANNEL_ID: '1489330857595502664',
    CATEGORY_IDS: {
        لجنة_الرقابة: '1489329692749332530', 
        تظلم_على_عقوبة_ادارية: '1489329697312473191',
        بلاغ_ضد_مخرب: '1489329702635049082',
        طلب_تعويض: '1489329732041572433',
        تقديم_لاعب_معتمد: '1489329746415456328',
        تقديم_صانع_محتوى: '1489329740094640272',
        بلاغ_على_مشكلة_فنية: '1493672627980468265',
        مساعدة_الموقع: '1489329757530095697',
        حرس_الحدود: '1493672774076731433',
        كراج_الميكانيكي: '1489329667130392576',
        ادارة_الشرطة: '1489329671144210452',
        الدفاع_المدني: '1489329688412160161',
        امن_المنشآت: '1489329663212781759',
        طلب_سكن: '1489329784356995183',
        ادارة_الديسكورد: '1489329788341588028'
    },
    ROLE_MENTIONS: {
        لجنة_الرقابة: '1483512548753019032',
        تظلم_على_عقوبة_ادارية: '1489328799689736444',
        بلاغ_ضد_مخرب: '1489328800880660631',
        طلب_تعويض: '1489328801937621062',
        تقديم_لاعب_معتمد: '1493676941201375373',
        تقديم_صانع_محتوى: '1489328846795833506',
        بلاغ_على_مشكلة_فنية: '1489328805335011521',
        مساعدة_الموقع: '1489328741699162262',
        حرس_الحدود: '1493678130647269496',
        كراج_الميكانيكي: '1493678603051991231',
        ادارة_الشرطة: '1493678665442263171',
        الدفاع_المدني: '1493678713114595418',
        امن_المنشآت: '1493678765174423692',
        طلب_سكن: '1493680673071042570',
        ادارة_الديسكورد: '1489328806618464337'
    },
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID || null,
    LOGS_CHANNEL_ID: process.env.LOGS_CHANNEL_ID || null,
    RATINGS_CHANNEL_ID: '1489330874032984212'
};

// ==================== الألوان ====================
const COLORS = {
    PRIMARY: 0xFFD700,
    SECONDARY: 0xFFA500,
    SUCCESS: 0x00FF00,
    DANGER: 0xFF0000,
    WARNING: 0xFFFF00,
    INFO: 0x5865F2,
    DARK: 0x1A1A1A
};

// ==================== قاعدة البيانات ====================
let ticketCounter = 1;
let stats = { totalCreated: 0, totalClosed: 0, totalRatings: 0, averageRating: 0, ratingSum: 0, categoryStats: {}, staffStats: {} };

const db = {
    activeTickets: new Map(),
    ticketData: new Map(),
    claimedTickets: new Map(),
    cooldowns: new Map(),
    transcripts: [],
    blacklist: new Set()
};

function loadStats() {
    try {
        const data = fs.readFileSync('./data/stats.json', 'utf8');
        const parsed = JSON.parse(data);
        stats = { ...stats, ...parsed };
    } catch (e) {
        console.log('Stats file not found, using defaults');
    }
}

function saveStats() {
    try {
        fs.writeFileSync('./data/stats.json', JSON.stringify(stats, null, 4));
    } catch (e) {
        console.error('Error saving stats:', e);
    }
}

function loadBlacklist() {
    try {
        const data = fs.readFileSync('./database.json', 'utf8');
        const json = JSON.parse(data);
        if (json.blacklist) json.blacklist.forEach(id => db.blacklist.add(id));
        if (json.ticketCounter) ticketCounter = json.ticketCounter;
        if (json.cooldowns) {
            for (const [userId, timestamp] of Object.entries(json.cooldowns)) {
                if (Date.now() - timestamp < 60000) {
                    db.cooldowns.set(userId, parseInt(timestamp));
                }
            }
        }
    } catch (e) {}
}

function saveData() {
    try {
        const activeTicketsObj = {};
        for (const [k, v] of db.activeTickets) activeTicketsObj[k] = v;
        
        const ticketDataObj = {};
        for (const [k, v] of db.ticketData) ticketDataObj[k] = v;
        
        const cooldownsObj = {};
        for (const [k, v] of db.cooldowns) cooldownsObj[k] = v;
        
        fs.writeFileSync('./database.json', JSON.stringify({
            blacklist: Array.from(db.blacklist),
            ticketCounter: ticketCounter,
            cooldowns: cooldownsObj,
            activeTickets: activeTicketsObj,
            ticketData: ticketDataObj,
            stats: { totalTickets: db.transcripts.length + db.activeTickets.size }
        }, null, 4));
    } catch (e) {}
}

function validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,}$/.test(username) && !username.includes(' ');
}

function validateCharacterName(name) {
    return name.length >= 4;
}

async function sendLog(client, embed, channelId = null) {
    const targetId = channelId || CONFIG.LOGS_CHANNEL_ID;
    if (!targetId) return;
    try {
        const channel = await client.channels.fetch(targetId);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Error sending log:', e);
    }
}

// دالة التحقق من الصلاحيات
function hasPermission(member, ticketType = null) {
    if (!member) return false;
    if (CONFIG.TICKET_ADMIN_ROLE_ID && member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID)) {
        return true;
    }
    
    if (ticketType) {
        return hasDepartmentRole(member, ticketType);
    }
    
    return false;
}

function hasDepartmentRole(member, ticketType) {
    const departmentRoleId = CONFIG.ROLE_MENTIONS[ticketType];
    if (!departmentRoleId) return false;
    return member.roles.cache.has(departmentRoleId);
}

// ==================== بيانات الفورم ====================
const ticketForms = {
    لجنة_الرقابة: {
        title: 'لجنة الرقابة',
        channelName: 'لجنة-الرقابة',
        emoji: '<:emoji_1:1475605826751434802>',
        fields: [
            { id: 'message_link', label: ' رقم التذكرة السابقة', placeholder: 'ارفق رقم التذكرة السابقة', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'player_name', label: ' اسم المشتكى عليه', placeholder: 'ارفق جميع البيانات', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'reason', label: ' سبب الشكوى', placeholder: 'هدفك وطلباتك', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'problem_desc', label: ' وصف المشكلة', placeholder: 'اوصف المشكلة بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'evidence', label: ' الأدلة', placeholder: 'ارفق روابط الأدلة', style: TextInputStyle.Paragraph, required: false, minLength: 10 }
        ]
    },
    تظلم_على_عقوبة_ادارية: {
        title: 'تظلم على عقوبة إدارية',
        channelName: 'تظلم-عقوبة',
        emoji: '<:emoji_2:1232428307795152906>',
        fields: [
            { id: 'your_name', label: ' اسمك في السيرفر', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'punishment_details', label: ' تفاصيل العقوبة', placeholder: 'نوع وتاريخ العقوبة', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'reason', label: ' سبب التظلم', placeholder: 'لماذا العقوبة غير عادلة؟', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'evidence', label: ' الأدلة', placeholder: 'روابط الفيديو أو الصور', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    بلاغ_ضد_مخرب: {
        title: 'بلاغ ضد مخرب',
        channelName: 'بلاغ-مخرب',
        emoji: '<:emoji_3:1099476157600120862>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'report_date', label: ' تاريخ المخالفة', placeholder: '2026/03/17', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'cheater_name', label: ' اسم المخرب', placeholder: 'اسم الشخص المخالف', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'clip_link', label: ' رابط الدليل', placeholder: 'يوتيوب 5 دقائق على الأقل', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'cheater_summary', label: ' ملخص المخالفة', placeholder: 'اشرح المخالفة', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    طلب_تعويض: {
        title: 'طلب تعويض',
        channelName: 'طلب-تعويض',
        emoji: '<:emoji_4:1099476157600120862>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'amount', label: ' المبلغ', placeholder: 'المبلغ المطلوب', style: TextInputStyle.Short, required: true, minLength: 1 },
            { id: 'reason', label: ' سبب التعويض', placeholder: 'كيف خسرت المبلغ؟', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'evidence', label: ' الأدلة', placeholder: 'فيديو أو صور', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    تقديم_لاعب_معتمد: {
        title: 'تقديم لاعب معتمد',
        channelName: 'تقديم-معتمد',
        emoji: '<:emoji_5:1166913543069765703>',
        fields: [
            { id: 'real_name', label: ' اسمك الحقيقي', placeholder: 'الاسم الكامل', style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'real_age', label: ' عمرك', placeholder: 'عمرك الحقيقي', style: TextInputStyle.Short, required: true, minLength: 1 },
            { id: 'level', label: ' مستواك', placeholder: 'مستوى خبرتك + صورة', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'experience', label: ' خبراتك', placeholder: 'الوظائف السابقة', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    تقديم_صانع_محتوى: {
        title: 'تقديم صانع محتوى',
        channelName: 'تقديم-محتوى',
        emoji: '<:emoji_6:1166909744259276871>',
        fields: [
            { id: 'content_type', label: ' نوع المحتوى', placeholder: 'ستريمر - يوتيوبر - تيك توكر', style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'channel_link', label: ' رابط القناة', placeholder: 'رابط المنصة', style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'followers', label: ' المتابعين', placeholder: 'عدد المتابعين', style: TextInputStyle.Short, required: true, minLength: 1 }
        ]
    },
    بلاغ_على_مشكلة_فنية: {
        title: 'بلاغ مشكلة فنية',
        channelName: 'مشكلة-فنية',
        emoji: '<:emoji_7:1483777089927647232>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'issue_type', label: ' نوع المشكلة', placeholder: 'لعبة / ديسكورد / موقع', style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'issue_desc', label: ' وصف المشكلة', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'tried_solutions', label: ' ما حاولت', placeholder: 'حلول جربتها', style: TextInputStyle.Paragraph, required: false, minLength: 10 }
        ]
    },
    مساعدة_الموقع: {
        title: 'مساعدة الموقع',
        channelName: 'مساعدة-موقع',
        emoji: '<:emoji_8:1484012024810704926>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'order_number', label: ' رقم الطلب', placeholder: 'رقم الأوردر', style: TextInputStyle.Short, required: true, minLength: 1 },
            { id: 'issue', label: ' المشكلة', placeholder: 'اشرح المشكلة', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    حرس_الحدود: {
        title: 'حرس الحدود',
        channelName: 'حرس-الحدود',
        emoji: '<:emoji_9:1483775005971185796>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'issue', label: ' الموضوع', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    كراج_الميكانيكي: {
        title: 'كراج الميكانيكي',
        channelName: 'كراج-ميكانيكي',
        emoji: '<:emoji_10:1098620145267654796>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'car_issue', label: ' مشكلة السيارة', placeholder: 'اشرح المشكلة', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    ادارة_الشرطة: {
        title: 'إدارة الشرطة',
        channelName: 'ادارة-شرطة',
        emoji: '<:emoji_11:1483774695294631976>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'issue', label: ' الموضوع', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    الدفاع_المدني: {
        title: 'الدفاع المدني',
        channelName: 'دفاع-مدني',
        emoji: '<:emoji_12:1098620211197915147>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'issue', label: ' الموضوع', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    امن_المنشآت: {
        title: 'أمن المنشآت',
        channelName: 'امن-منشآت',
        emoji: '<:emoji_13:1484304537119359026>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'issue', label: ' الموضوع', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    طلب_سكن: {
        title: 'طلب سكن',
        channelName: 'طلب-سكن',
        emoji: '<:emoji_14:1483778359908368505>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'إنجليزي فقط', style: TextInputStyle.Short, required: true, minLength: 3, validate: validateUsername },
            { id: 'nickname', label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4, validate: validateCharacterName },
            { id: 'family_name', label: ' اسم العائلة', placeholder: 'اسم العائلة', style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'house_location', label: ' موقع السكن', placeholder: 'المكان المطلوب', style: TextInputStyle.Short, required: true, minLength: 4 }
        ]
    },
    ادارة_الديسكورد: {
        title: 'إدارة الديسكورد',
        channelName: 'ادارة-ديسكورد',
        emoji: '<:emoji_15:1484191828839497898>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'اكتب اسمك', style: TextInputStyle.Short, required: true, minLength: 3 },
            { id: 'issue', label: ' الموضوع', placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    }
};

function generateTicketNumber() {
    const num = ticketCounter;
    ticketCounter++;
    saveData();
    return num;
}

async function createTranscript(channel, closer, reason = 'غير محدد') {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sorted = Array.from(messages.values()).reverse();
        
        let html = `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${channel.name}</title>
        <style>body{background:#1A1A1A;color:#FFD700;font-family:Segoe UI;padding:20px}
        .header{background:#2D2D2D;padding:20px;border-radius:8px;border-left:4px solid #FFD700;margin-bottom:20px}
        .msg{background:#2D2D2D;padding:10px;margin:5px 0;border-radius:5px;border-right:3px solid #FFA500}
        .author{color:#FFD700;font-weight:bold}.time{color:#888;font-size:0.8em}</style></head><body>
        <div class="header"><h1>🎫 ${channel.name}</h1><p>أغلقها: ${closer}</p><p>السبب: ${reason}</p><p>${new Date().toLocaleString('ar-SA')}</p></div><div class="messages">`;
        
        for (const msg of sorted) {
            if (msg.author.bot) continue;
            html += `<div class="msg"><span class="author">${msg.author.tag}</span> <span class="time">${msg.createdAt.toLocaleString('ar-SA')}</span><p>${msg.content.replace(/</g, '&lt;')}</p></div>`;
        }
        
        html += `</div></body></html>`;
        return html;
    } catch (e) {
        return `<html><body>Error</body></html>`;
    }
}

function getMention(ticketType) {
    const roleId = CONFIG.ROLE_MENTIONS[ticketType];
    if (!roleId) return '@here';
    return `<@&${roleId}>`;
}

// ==================== لوحة تحكم التذاكر ====================
async function showTicketDashboard(interaction, member, ticketType = null) {
    // ⭐ مهم: نرد فوراً عشان ما يصير "Unknown interaction"
    await interaction.deferReply({ ephemeral: true });
    
    const isTicketAdmin = member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID);
    
    // جمع التذاكر النشطة
    let tickets = [];
    
    for (const [channelId, data] of db.ticketData) {
        if (ticketType && data.type !== ticketType) continue;
        
        if (!isTicketAdmin && !hasDepartmentRole(member, data.type)) continue;
        
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
            const claimedBy = db.claimedTickets.get(channelId);
            tickets.push({
                ...data,
                channel: channel,
                claimedBy: claimedBy,
                claimedName: claimedBy ? `<@${claimedBy}>` : '⏳ قيد الانتظار'
            });
        }
    }
    
    // ترتيب التذاكر
    tickets.sort((a, b) => {
        if (a.claimedBy && !b.claimedBy) return 1;
        if (!a.claimedBy && b.claimedBy) return -1;
        return b.createdAt - a.createdAt;
    });
    
    const perPage = 5;
    const totalPages = Math.ceil(tickets.length / perPage) || 1;
    let currentPage = 0;
    
    const generateEmbed = (page) => {
        const start = page * perPage;
        const end = start + perPage;
        const pageTickets = tickets.slice(start, end);
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📊 لوحة تحكم التذاكر')
            .setFooter({ text: `صفحة ${page + 1}/${totalPages} • 𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲` })
            .setTimestamp();
        
        const waiting = tickets.filter(t => !t.claimedBy).length;
        const claimed = tickets.filter(t => t.claimedBy).length;
        
        let description = `**إجمالي التذاكر النشطة: ${tickets.length}**\n\n`;
        description += `⏳ قيد الانتظار: **${waiting}** | `;
        description += `✋ مستلمة: **${claimed}**`;
        
        if (isTicketAdmin) {
            description += `\n\n⭐ أنت مسؤول التذاكر - تشوف كل الأقسام`;
        }
        
        embed.setDescription(description);
        
        if (pageTickets.length > 0) {
            pageTickets.forEach((t) => {
                const status = t.claimedBy ? '✅' : '⏳';
                const type = ticketForms[t.type]?.title || t.type;
                const timeAgo = `<t:${Math.floor(t.createdAt / 1000)}:R>`;
                
                embed.addFields({
                    name: `${status} #${t.ticketNumber} - ${type}`,
                    value: `👤 صاحبها: <@${t.ownerId}>\n` +
                           `✋ الحالة: ${t.claimedName}\n` +
                           `⏰ مفتوحة: ${timeAgo}\n` +
                           `🔗 ${t.channel}`,
                    inline: false
                });
            });
        } else {
            embed.addFields({
                name: '📭 لا توجد تذاكر',
                value: 'لا توجد تذاكر نشطة حالياً',
                inline: false
            });
        }
        
        return embed;
    };
    
    const generateComponents = (page) => {
        const rows = [];
        
        // صف التنقل
        const navRow = new ActionRowBuilder();
        
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`dash_prev_${member.id}`)
                .setLabel('◀ السابق')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`dash_page_${member.id}`)
                .setLabel(`${page + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`dash_next_${member.id}`)
                .setLabel('التالي ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`dash_refresh_${member.id}`)
                .setLabel('🔄 تحديث')
                .setStyle(ButtonStyle.Success)
        );
        
        rows.push(navRow);
        
        // صف البلاك ليست - فقط لمسؤول التذاكر
        if (isTicketAdmin) {
            const blacklistRow = new ActionRowBuilder();
            
            blacklistRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`dash_blacklist_add_${member.id}`)
                    .setLabel('🚫 إضافة للبلاك ليست')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`dash_blacklist_remove_${member.id}`)
                    .setLabel('✅ إزالة من البلاك ليست')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dash_blacklist_view_${member.id}`)
                    .setLabel('📋 عرض البلاك ليست')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            rows.push(blacklistRow);
            
            // صف الإحصائيات
            const statsRow = new ActionRowBuilder();
            
            statsRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`dash_stats_${member.id}`)
                    .setLabel('📊 الإحصائيات')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dash_topstaff_${member.id}`)
                    .setLabel('👑 أفضل الموظفين')
                    .setStyle(ButtonStyle.Primary)
            );
            
            rows.push(statsRow);
        }
        
        return rows;
    };
    
    // إرسال الرد (بعد deferReply نستخدم editReply)
    const dashboardMessage = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: generateComponents(currentPage)
    });
    
    // Collector للأزرار - ⭐ مهم: نستخدم message.createMessageComponentCollector
    const collector = dashboardMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === member.id,
        time: 600000 // 10 دقائق
    });
    
    collector.on('collect', async (i) => {
        // ⭐ مهم: نرد فوراً على كل تفاعل
        await i.deferUpdate().catch(() => {});
        
        const customId = i.customId;
        
        // أزرار التنقل
        if (customId === `dash_prev_${member.id}`) {
            currentPage--;
            await i.editReply({
                embeds: [generateEmbed(currentPage)],
                components: generateComponents(currentPage)
            });
        } else if (customId === `dash_next_${member.id}`) {
            currentPage++;
            await i.editReply({
                embeds: [generateEmbed(currentPage)],
                components: generateComponents(currentPage)
            });
        } else if (customId === `dash_refresh_${member.id}`) {
            collector.stop();
            // إعادة تحميل
            await showTicketDashboard(interaction, member, ticketType);
        }
        
        // أزرار البلاك ليست
        else if (customId === `dash_blacklist_add_${member.id}`) {
            const modal = new ModalBuilder()
                .setCustomId(`blacklist_add_modal_${member.id}`)
                .setTitle('🚫 إضافة للبلاك ليست');
            
            const input = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ايدي المستخدم')
                .setPlaceholder('ضع ايدي المستخدم هنا')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
        
        else if (customId === `dash_blacklist_remove_${member.id}`) {
            const modal = new ModalBuilder()
                .setCustomId(`blacklist_remove_modal_${member.id}`)
                .setTitle('✅ إزالة من البلاك ليست');
            
            const input = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ايدي المستخدم')
                .setPlaceholder('ضع ايدي المستخدم هنا')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
        
        else if (customId === `dash_blacklist_view_${member.id}`) {
            const list = Array.from(db.blacklist).map((id, index) => `${index + 1}. <@${id}> (${id})`).join('\n') || 'لا يوجد أحد في البلاك ليست';
            
            const embed = new EmbedBuilder()
                .setColor(COLORS.DANGER)
                .setTitle('🚫 قائمة البلاك ليست')
                .setDescription(list)
                .setFooter({ text: `العدد: ${db.blacklist.size}` })
                .setTimestamp();
            
            // ⭐ نرسل كـ followUp عشان ما نخرب اللوحة
            await i.followUp({ embeds: [embed], ephemeral: true });
        }
        
        // أزرار الإحصائيات
        else if (customId === `dash_stats_${member.id}`) {
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('📊 إحصائيات النظام')
                .addFields(
                    { name: '🎫 تذاكر نشطة', value: `${db.activeTickets.size}`, inline: true },
                    { name: '✋ مستلمة', value: `${db.claimedTickets.size}`, inline: true },
                    { name: '🔒 مغلقة', value: `${stats.totalClosed || 0}`, inline: true },
                    { name: '📈 إجمالي مفتوحة', value: `${stats.totalCreated || 0}`, inline: true },
                    { name: '⭐ التقييمات', value: `${stats.totalRatings || 0}`, inline: true },
                    { name: '⭐ متوسط التقييم', value: `${stats.averageRating?.toFixed(2) || 0}/5`, inline: true },
                    { name: '🚫 البلاك ليست', value: `${db.blacklist.size}`, inline: true }
                )
                .setTimestamp();
            
            await i.followUp({ embeds: [embed], ephemeral: true });
        }
        
        else if (customId === `dash_topstaff_${member.id}`) {
            const staffArray = Object.entries(stats.staffStats || {})
                .map(([id, data]) => ({
                    id,
                    claimed: data.claimed || 0,
                    closed: data.closed || 0,
                    total: (data.claimed || 0) + (data.closed || 0)
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            const topList = staffArray.length > 0 
                ? staffArray.map((s, i) => `${i+1}. <@${s.id}> - استلام: ${s.claimed} | إغلاق: ${s.closed}`).join('\n')
                : 'لا توجد بيانات';

            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('👑 أفضل الموظفين')
                .setDescription(topList)
                .setFooter({ text: `آخر تحديث: ${new Date().toLocaleString('ar-SA')}` })
                .setTimestamp();
            
            await i.followUp({ embeds: [embed], ephemeral: true });
        }
    });
    
    collector.on('end', () => {
        // تعطيل الأزرار بعد الانتهاء
        try {
            const disabledRows = dashboardMessage.components.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(btn => {
                    newRow.addComponents(
                        ButtonBuilder.from(btn).setDisabled(true)
                    );
                });
                return newRow;
            });
            
            interaction.editReply({ 
                content: '⏰ انتهت الجلسة',
                components: disabledRows 
            }).catch(() => {});
        } catch (e) {}
    });
}

// ==================== الأوامر Slash ====================
const slashCommands = [
    new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد لوحة نظام التذاكر في هذا الروم'),
    new SlashCommandBuilder().setName('setup-dashboard').setDescription('إعداد زر لوحة تحكم التذاكر للمشرفين في هذا الروم'),
    new SlashCommandBuilder().setName('dashboard').setDescription('فتح لوحة تحكم التذاكر للمشرفين'),
    new SlashCommandBuilder().setName('stats').setDescription('عرض إحصائيات نظام التذاكر'),
    new SlashCommandBuilder().setName('blacklist').setDescription('إدارة القائمة السوداء')
        .addSubcommand(sub => sub.setName('add').setDescription('إضافة مستخدم').addUserOption(opt => opt.setName('user').setDescription('المستخدم').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('إزالة مستخدم').addUserOption(opt => opt.setName('user').setDescription('المستخدم').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض القائمة السوداء'))
].map(cmd => cmd.toJSON());

async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: slashCommands });
        console.log('✅ تم تسجيل أوامر Slash بنجاح');
    } catch (e) { console.error('❌ خطأ في تسجيل أوامر Slash:', e.message); }
}

async function joinVoice24h() {
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    if (!voiceChannelId) return;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const voiceChannel = await guild.channels.fetch(voiceChannelId).catch(() => null);
        if (!voiceChannel) return;
        const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
        connection.on(VoiceConnectionStatus.Disconnected, async () => { try { await entersState(connection, VoiceConnectionStatus.Connecting, 5000); } catch { setTimeout(() => joinVoice24h(), 10000); } });
        console.log(`✅ انضم البوت للروم الصوتي: ${voiceChannel.name}`);
    } catch (e) { setTimeout(() => joinVoice24h(), 30000); }
}

// ==================== events ====================
client.once('clientReady', async () => {
    loadBlacklist();
    loadStats();
    await registerSlashCommands();
    await joinVoice24h();
    console.log(`✅ 𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 Ticket System Ready — ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // إرسال زر لوحة التحكم
    if (message.content === '!setupdashboard') {
        if (!message.member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID)) {
            return message.reply('❌ ليس لديك صلاحية - مسؤول التذاكر فقط');
        }
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📊 لوحة تحكم التذاكر')
            .setDescription('اضغط على الزر أدناه لفتح لوحة التحكم الخاصة بك\n\n**ملاحظة:** اللوحة تظهر لك وحدك (خاصة)')
            .setThumbnail(message.guild.iconURL())
            .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • Ticket System' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_dashboard_button')
                    .setLabel('📊 فتح لوحة التحكم')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }
    
    // لوحة تحكم التذاكر - !dashboard (احتياطي)
    if (message.content === '!dashboard') {
        if (!hasPermission(message.member)) {
            return message.reply('❌ ليس لديك صلاحية - يجب أن تكون من أحد الأقسام أو مسؤول التذاكر');
        }
        
        // ⭐ نعمل interaction وهمي
        const fakeInteraction = {
            id: message.id,
            user: message.author,
            member: message.member,
            guild: message.guild,
            deferred: false,
            replied: false,
            deferReply: async () => {
                fakeInteraction.deferred = true;
                return message;
            },
            editReply: async (options) => {
                return message.reply(options);
            },
            followUp: async (options) => {
                return message.reply(options);
            }
        };
        
        await showTicketDashboard(fakeInteraction, message.member);
        await message.delete().catch(() => {});
        return;
    }
    
    // Ticket command
    if (message.content === '!ticket') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 - نظام التذاكر')
            .setDescription('مرحباً بك في نظام التذاكر 👋\n\nيمكنك من خلال هذا النظام التواصل مع الإدارة لحل مشكلتك\nاختر نوع التذكرة المناسب من القائمة أدناه')
            .addFields(
                { name: '⚠️ ملاحظات هامة', value: '• اختر النوع المناسب\n• كن واضحاً في شرح مشكلتك\n• احترم قوانين السيرفر\n• لا تقم بمنشن الإدارة' }
            )
            .setThumbnail('https://cdn.discordapp.com/icons/1483511911965397075/283ad0adf2dac3875b71f3263f26e9c7.png?size=1024')
            .setImage('https://cdn.discordapp.com/attachments/1484861943381622784/1485284674577109093/file_00000000d59c71f4a16f620083795bfd.png?ex=69c1f765&is=69c0a5e5&hm=4e273e4e15fe71505d94bb300088ee41ed2046b30180e2e10ebba3d89e974451&')
            .setTimestamp()
            .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • Ticket System', iconURL: message.guild.iconURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_menu_main')
                    .setPlaceholder('📩 اختر نوع التذكرة')
                    .addOptions(Object.entries(ticketForms).map(([key, data]) => ({
                        label: data.title,
                        value: key,
                        emoji: data.emoji,
                        description: `فتح تذكرة في ${data.title}`
                    })))
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async (interaction) => {
    
    // ==================== معالجة أوامر Slash ====================
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /setup-ticket — إرسال واجهة فتح التذاكر في الروم الحالي
        if (commandName === 'setup-ticket') {
            if (!interaction.member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID)) {
                return interaction.reply({ content: '❌ هذا الأمر للمشرفين فقط', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 — نظام التذاكر')
                .setDescription('مرحباً بك في نظام التذاكر 👋\n\nيمكنك من خلال هذا النظام التواصل مع الإدارة لحل مشكلتك\nاختر نوع التذكرة المناسب من القائمة أدناه')
                .addFields({ name: '⚠️ ملاحظات هامة', value: '• اختر النوع المناسب\n• كن واضحاً في شرح مشكلتك\n• احترم قوانين السيرفر\n• لا تقم بمنشن الإدارة' })
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp()
                .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • Ticket System', iconURL: interaction.guild.iconURL() });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_menu_main')
                    .setPlaceholder('📩 اختر نوع التذكرة')
                    .addOptions(Object.entries(ticketForms).map(([key, data]) => ({
                        label: data.title,
                        value: key,
                        emoji: data.emoji,
                        description: `فتح تذكرة في ${data.title}`
                    })))
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ تم إعداد نظام التذاكر بنجاح في هذا الروم!', ephemeral: true });
        }

        // /setup-dashboard — إرسال زر لوحة التحكم
        if (commandName === 'setup-dashboard') {
            if (!interaction.member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID)) {
                return interaction.reply({ content: '❌ هذا الأمر للمشرفين فقط', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('📊 لوحة تحكم التذاكر')
                .setDescription('اضغط على الزر أدناه لفتح لوحة التحكم الخاصة بك\n\n**ملاحظة:** اللوحة تظهر لك وحدك (خاصة)')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • Ticket System' })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_dashboard_button').setLabel('📊 فتح لوحة التحكم').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ تم إعداد لوحة التحكم بنجاح!', ephemeral: true });
        }

        // /dashboard — فتح لوحة التحكم مباشرة
        if (commandName === 'dashboard') {
            if (!hasPermission(interaction.member)) {
                return interaction.reply({ content: '❌ ليس لديك صلاحية', ephemeral: true });
            }
            await showTicketDashboard(interaction, interaction.member);
            return;
        }

        // /stats — إحصائيات التذاكر
        if (commandName === 'stats') {
            if (!hasPermission(interaction.member)) {
                return interaction.reply({ content: '❌ ليس لديك صلاحية', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('📊 إحصائيات نظام التذاكر')
                .addFields(
                    { name: '🎫 إجمالي التذاكر المفتوحة', value: `${stats.totalCreated || 0}`, inline: true },
                    { name: '🔒 إجمالي المغلقة', value: `${stats.totalClosed || 0}`, inline: true },
                    { name: '⭐ إجمالي التقييمات', value: `${stats.totalRatings || 0}`, inline: true },
                    { name: '📈 متوسط التقييم', value: `${(stats.averageRating || 0).toFixed(2)}/5`, inline: true },
                    { name: '🔵 تذاكر نشطة الآن', value: `${db.activeTickets.size}`, inline: true }
                )
                .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • Ticket System' })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // /blacklist
        if (commandName === 'blacklist') {
            if (!interaction.member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID)) {
                return interaction.reply({ content: '❌ هذا الأمر للمشرفين فقط', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();

            if (sub === 'add') {
                const target = interaction.options.getUser('user');
                if (db.blacklist.has(target.id)) return interaction.reply({ content: '❌ المستخدم في القائمة السوداء بالفعل', ephemeral: true });
                db.blacklist.add(target.id);
                saveData();
                const logEmbed = new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🚫 إضافة للقائمة السوداء')
                    .addFields({ name: 'المستخدم', value: `<@${target.id}>`, inline: true }, { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true })
                    .setTimestamp();
                await sendLog(client, logEmbed, CONFIG.BLACKLIST_LOG_CHANNEL_ID);
                return interaction.reply({ content: `✅ تم إضافة <@${target.id}> للقائمة السوداء`, ephemeral: true });
            }

            if (sub === 'remove') {
                const target = interaction.options.getUser('user');
                if (!db.blacklist.has(target.id)) return interaction.reply({ content: '❌ المستخدم ليس في القائمة السوداء', ephemeral: true });
                db.blacklist.delete(target.id);
                saveData();
                return interaction.reply({ content: `✅ تم إزالة <@${target.id}> من القائمة السوداء`, ephemeral: true });
            }

            if (sub === 'list') {
                const list = Array.from(db.blacklist);
                const embed = new EmbedBuilder().setColor(COLORS.WARNING).setTitle('📋 القائمة السوداء')
                    .setDescription(list.length > 0 ? list.map(id => `• <@${id}>`).join('\n') : 'القائمة السوداء فارغة')
                    .setFooter({ text: `عدد الأعضاء: ${list.length}` })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        return;
    }


    // زر فتح لوحة التحكم الثابت
    if (interaction.isButton() && interaction.customId === 'open_dashboard_button') {
        const member = interaction.member;
        
        // التحقق من الصلاحية
        if (!hasPermission(member)) {
            return await interaction.reply({ 
                content: '❌ ليس لديك صلاحية - يجب أن تكون من أحد الأقسام أو مسؤول التذاكر', 
                ephemeral: true 
            });
        }
        
        // فتح لوحة التحكم
        await showTicketDashboard(interaction, member);
        return;
    }
    
    // Blacklist add modal من لوحة التحكم
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.includes('blacklist_add_modal_')) {
        const userId = interaction.fields.getTextInputValue('user_id').replace(/[<@!>]/g, '');
        
        try {
            const targetUser = await client.users.fetch(userId);
            
            if (db.blacklist.has(userId)) {
                return await interaction.reply({ 
                    content: '❌ هذا المستخدم موجود في البلاك ليست بالفعل', 
                    ephemeral: true 
                });
            }
            
            db.blacklist.add(userId);
            saveData();
            
            // إرسال للروم المحدد
            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.DANGER)
                .setTitle('🚫 إضافة للبلاك ليست')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'المستخدم', value: `<@${userId}>`, inline: true },
                    { name: 'الايدي', value: userId, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'التاريخ', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            
            await sendLog(client, logEmbed, CONFIG.BLACKLIST_LOG_CHANNEL_ID);
            
            await interaction.reply({ 
                content: `✅ تم إضافة <@${userId}> للبلاك ليست`, 
                ephemeral: true 
            });
            
        } catch (e) {
            await interaction.reply({ 
                content: '❌ لم يتم العثور على المستخدم', 
                ephemeral: true 
            });
        }
    }
    
    // Blacklist remove modal من لوحة التحكم
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.includes('blacklist_remove_modal_')) {
        const userId = interaction.fields.getTextInputValue('user_id').replace(/[<@!>]/g, '');
        
        try {
            const targetUser = await client.users.fetch(userId).catch(() => null);
            
            if (!db.blacklist.has(userId)) {
                return await interaction.reply({ 
                    content: '❌ هذا المستخدم ليس في البلاك ليست', 
                    ephemeral: true 
                });
            }
            
            db.blacklist.delete(userId);
            saveData();
            
            // إرسال للروم المحدد
            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('✅ إزالة من البلاك ليست')
                .setThumbnail(targetUser?.displayAvatarURL() || null)
                .addFields(
                    { name: 'المستخدم', value: `<@${userId}>`, inline: true },
                    { name: 'الايدي', value: userId, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'التاريخ', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            
            await sendLog(client, logEmbed, CONFIG.BLACKLIST_LOG_CHANNEL_ID);
            
            await interaction.reply({ 
                content: `✅ تم إزالة <@${userId}> من البلاك ليست`, 
                ephemeral: true 
            });
            
        } catch (e) {
            await interaction.reply({ 
                content: '❌ حدث خطأ', 
                ephemeral: true 
            });
        }
    }
    
    // Main menu selection
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu_main') {
        
        if (db.blacklist.has(interaction.user.id)) {
            return await interaction.reply({
                content: '🚫 أنت محظور من فتح التذاكر',
                ephemeral: true
            });
        }
        
        // Cooldown check (60s)
        if (db.cooldowns.has(interaction.user.id)) {
            const lastTime = db.cooldowns.get(interaction.user.id);
            if (Date.now() - lastTime < 60000) {
                const remaining = Math.ceil((60000 - (Date.now() - lastTime)) / 1000);
                return await interaction.reply({
                    content: `⏳ انتظر ${remaining} ثانية قبل محاولة أخرى`,
                    ephemeral: true
                });
            }
        }

        const selected = interaction.values[0];
        const formData = ticketForms[selected];

        if (!formData) {
            return await interaction.reply({
                content: '❌ نوع التذكرة غير موجود',
                ephemeral: true
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`${formData.emoji} ${formData.title}`)
            .setDescription('سيتم فتح تذكرة جديدة\nاملأ النموذج التالي')
            .addFields(
                { name: '⚠️ تنبيه', value: '• تأكد من صحة المعلومات\n• أرفق جميع الأدلة\n• عدم الرد = إغلاق تلقائي بعد 12 ساعة' }
            )
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${selected}`)
                    .setLabel('✅ تأكيد')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_ticket')
                    .setLabel('❌ إلغاء')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            ephemeral: true
        });
    }

    // Confirm button
    if (interaction.isButton() && interaction.customId.startsWith('confirm_')) {
        const ticketType = interaction.customId.replace('confirm_', '');
        const formData = ticketForms[ticketType];

        const modal = new ModalBuilder()
            .setCustomId(`modal_${ticketType}`)
            .setTitle(formData.title);

        const rows = formData.fields.map(field => {
            const input = new TextInputBuilder()
                .setCustomId(field.id)
                .setLabel(field.label)
                .setPlaceholder(field.placeholder)
                .setStyle(field.style)
                .setRequired(field.required);
            if (field.minLength) input.setMinLength(field.minLength);
            return new ActionRowBuilder().addComponents(input);
        });

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }

    // Cancel button
    if (interaction.isButton() && interaction.customId === 'cancel_ticket') {
        await interaction.update({
            content: '❌ تم الإلغاء',
            embeds: [],
            components: []
        });
    }

    // Modal submit
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_')) {
        const ticketType = interaction.customId.replace('modal_', '');
        const formData = ticketForms[ticketType];
        const member = interaction.member;
        const guild = interaction.guild;

        const responses = {};
        for (const field of formData.fields) {
            const value = interaction.fields.getTextInputValue(field.id);
            
            if (field.validate && !field.validate(value)) {
                return await interaction.reply({
                    content: `❌ حقل "${field.label}" غير صالح`,
                    ephemeral: true
                });
            }
            if (field.minLength && value.length < field.minLength) {
                return await interaction.reply({
                    content: `❌ "${field.label}" يجب ${field.minLength}+ أحرف`,
                    ephemeral: true
                });
            }
            responses[field.id] = value;
        }

        const ticketNumber = generateTicketNumber();
        const channelName = `${ticketNumber}-${formData.channelName}`;

        try {
            const perms = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ];

            // إضافة رول القسم للصلاحيات فقط
            const departmentRoleId = CONFIG.ROLE_MENTIONS[ticketType];
            if (departmentRoleId) {
                perms.push({ 
                    id: departmentRoleId, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                });
            }

            const categoryId = CONFIG.CATEGORY_IDS[ticketType];
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId || null,
                permissionOverwrites: perms,
                topic: `🎫 #${ticketNumber} | ${formData.title}`
            });

            // حفظ بيانات التذكرة
            const ticketInfo = {
                channelId: ticketChannel.id,
                ticketNumber: ticketNumber,
                type: ticketType,
                ownerId: member.id,
                createdAt: Date.now()
            };
            
            db.activeTickets.set(member.id, ticketInfo);
            db.ticketData.set(ticketChannel.id, ticketInfo);
            saveData();

            // Ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle(`${formData.emoji} تذكرة #${ticketNumber}`)
                .setDescription(`**${formData.title}**`)
                .addFields(
                    { name: '👤 صاحب التذكرة', value: `<@${member.id}>`, inline: true },
                    { name: '📋 الحالة', value: '⏳ قيد الانتظار', inline: true },
                    { name: '⏰ الوقت', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                    { name: '📄 المعلومات', value: formData.fields.map(f => `**${f.label}:**\n\`\`\`${responses[f.id] || '-'}\`\`\``).join('\n') }
                )
                .setThumbnail(guild.iconURL())
                .setFooter({ text: `𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • #${ticketNumber}`, iconURL: guild.iconURL() })
                .setTimestamp();

            // الأزرار
            const adminRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('rename_ticket').setLabel('تغيير الاسم').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('add_user').setLabel('إضافة عضو').setStyle(ButtonStyle.Secondary).setEmoji('➕')
                );

            const ownerMention = `<@${member.id}>`;
            const roleMention = getMention(ticketType);
            const ticketMessage = await ticketChannel.send({
                content: `${roleMention}\nتم انشاء تذكرة جديدة 🎫\nصاحب التذكرة : ${ownerMention}\nيرجى التحلي بالصبر وعدم منشن اي اداري وسيتم التعامل مع مشكلتك في اسرع وقت⌛`,
                embeds: [ticketEmbed],
                components: [adminRow]
            });

            // Increment stats
            stats.totalCreated = (stats.totalCreated || 0) + 1;
            stats.categoryStats[ticketType] = { opened: (stats.categoryStats[ticketType]?.opened || 0) + 1, closed: stats.categoryStats[ticketType]?.closed || 0 };
            saveStats();

            // DM user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(COLORS.SUCCESS)
                    .setTitle('✅ تم فتح تذكرتك')
                    .setDescription(`تذكرتك في **${formData.title}**`)
                    .addFields(
                        { name: '🎫 الرقم', value: `#${ticketNumber}`, inline: true },
                        { name: '📍 القناة', value: `${ticketChannel}`, inline: true }
                    )
                    .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲' })
                    .setTimestamp();
                await member.send({ embeds: [dmEmbed] });
            } catch (e) {}

            // Log فتح التذكرة
            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('🎫 تذكرة جديدة')
                .addFields(
                    { name: 'الرقم', value: `#${ticketNumber}`, inline: true },
                    { name: 'النوع', value: formData.title, inline: true },
                    { name: 'الصاحب', value: `<@${member.id}>`, inline: true },
                    { name: 'القناة', value: `${ticketChannel}`, inline: true }
                )
                .setTimestamp();
            
            await sendLog(client, logEmbed).catch(console.error);

            await interaction.reply({
                content: `✅ تم فتح تذكرتك: ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ حدث خطأ', ephemeral: true });
        }
    }

    // Button handlers (guild only - rate_ buttons handled below)
    if (interaction.isButton() && !interaction.customId.startsWith('rate_')) {
        const member = interaction.member;
        const ticketInfo = db.ticketData.get(interaction.channel.id);
        const ticketType = ticketInfo?.type;
        
        // التحقق من الصلاحيات (مسؤول التذاكر أو رول القسم)
        let hasDeptPermission = hasPermission(member, ticketType);

        // زر إضافة عضو - للمسؤول أو القسم
        if (interaction.customId === 'add_user') {
            if (!hasDeptPermission) {
                return await interaction.reply({ 
                    content: '❌ ليس لديك صلاحية', 
                    ephemeral: true 
                });
            }
            
            const modal = new ModalBuilder()
                .setCustomId('add_user_modal')
                .setTitle('إضافة عضو');
            const input = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ايدي العضو')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // باقي الأزرار
        if (!hasDeptPermission) {
            return await interaction.reply({ 
                content: '❌ ليس لديك صلاحية', 
                ephemeral: true 
            });
        }

        const ticketNum = ticketInfo?.ticketNumber || 'unknown';

        // Claim
        if (interaction.customId === 'claim_ticket') {
            const channelId = interaction.channel.id;
            
            if (db.claimedTickets.has(channelId)) {
                const claimedBy = db.claimedTickets.get(channelId);
                if (claimedBy !== interaction.user.id) {
                    return await interaction.reply({ 
                        content: `❌ مستلمة من <@${claimedBy}>`, 
                        ephemeral: true 
                    });
                }
                return await interaction.reply({ content: '✅ أنت مستلمها!', ephemeral: true });
            }

            db.claimedTickets.set(channelId, interaction.user.id);
            saveData();
            
            // Update embed - تعديل صحيح
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 10 });
                const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
                if (botMsg && botMsg.embeds[0]) {
                    const oldEmbed = botMsg.embeds[0];
                    
                    // نبني embed جديد بدل التعديل
                    const updatedEmbed = new EmbedBuilder()
                        .setColor(COLORS.PRIMARY)
                        .setTitle(oldEmbed.title)
                        .setDescription(oldEmbed.description)
                        .setThumbnail(oldEmbed.thumbnail?.url || null)
                        .setFooter(oldEmbed.footer || null)
                        .setTimestamp();
                    
                    // نضيف الحقول المحدثة
                    if (oldEmbed.fields[0]) {
                        updatedEmbed.addFields({ 
                            name: oldEmbed.fields[0].name, 
                            value: oldEmbed.fields[0].value, 
                            inline: oldEmbed.fields[0].inline 
                        });
                    }
                    
                    if (oldEmbed.fields[1]) {
                        updatedEmbed.addFields({ 
                            name: oldEmbed.fields[1].name, 
                            value: oldEmbed.fields[1].value, 
                            inline: oldEmbed.fields[1].inline 
                        });
                    }
                    
                    updatedEmbed.addFields({ 
                        name: '✋ مستلمها', 
                        value: `<@${interaction.user.id}>`, 
                        inline: true 
                    });
                    
                    const infoField = oldEmbed.fields.find(f => f.name === '📄 المعلومات');
                    if (infoField) {
                        updatedEmbed.addFields({ 
                            name: infoField.name, 
                            value: infoField.value, 
                            inline: false 
                        });
                    }

                    await botMsg.edit({ embeds: [updatedEmbed] });
                }
            } catch (e) {
                console.error('Error updating embed:', e);
            }

            // Stats update
            stats.staffStats[interaction.user.id] = stats.staffStats[interaction.user.id] || { claimed: 0, closed: 0 };
            stats.staffStats[interaction.user.id].claimed += 1;
            saveStats();

            // Log استلام التذكرة
            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('✋ استلام تذكرة')
                .addFields(
                    { name: 'الرقم', value: `#${ticketNum}`, inline: true },
                    { name: 'القناة', value: `${interaction.channel}`, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, logEmbed).catch(console.error);

            return await interaction.reply({ content: '✅ تم الاستلام', ephemeral: true });
        }

        // Close
        if (interaction.customId === 'close_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('close_modal')
                .setTitle('سبب الإغلاق');
            const input = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('السبب')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // Rename
        if (interaction.customId === 'rename_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('rename_modal')
                .setTitle('تغيير الاسم');
            const input = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('الاسم الجديد')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // Delete ticket
        if (interaction.customId === 'delete_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('delete_modal')
                .setTitle('تأكيد الحذف');
            const input = new TextInputBuilder()
                .setCustomId('confirm')
                .setLabel('اكتب "حذف" للتأكيد')
                .setPlaceholder('حذف')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
    }

    // Add user modal
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'add_user_modal') {
        const member = interaction.member;
        const ticketInfo = db.ticketData.get(interaction.channel.id);
        const ticketType = ticketInfo?.type;
        
        // التحقق من صلاحية القسم
        if (!hasPermission(member, ticketType)) {
            return await interaction.reply({ 
                content: '❌ ليس لديك صلاحية', 
                ephemeral: true 
            });
        }
        
        const userId = interaction.fields.getTextInputValue('user_id');
        try {
            const target = await interaction.guild.members.fetch(userId);
            await interaction.channel.permissionOverwrites.create(target, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
            });
            
            const embed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setDescription(`➕ **تم إضافة <@${target.id}>**`)
                .setTimestamp();
            await interaction.channel.send({ embeds: [embed] });

            // Log إضافة عضو
            const ticketNum = ticketInfo?.ticketNumber || 'unknown';

            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('➕ إضافة عضو للتذكرة')
                .addFields(
                    { name: 'الرقم', value: `#${ticketNum}`, inline: true },
                    { name: 'القناة', value: `${interaction.channel}`, inline: true },
                    { name: 'العضو المضاف', value: `<@${target.id}>`, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, logEmbed).catch(console.error);

            await interaction.reply({ content: '✅ تم', ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
        }
    }

    // Rename modal
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'rename_modal') {
        const newName = interaction.fields.getTextInputValue('new_name');
        try {
            const oldName = interaction.channel.name;
            await interaction.channel.setName(newName);
            
            const embed = new EmbedBuilder()
                .setColor(COLORS.WARNING)
                .setDescription(`✏️ **تغيير الاسم:**\n\`${oldName}\` → \`${newName}\``)
                .setTimestamp();
            await interaction.channel.send({ embeds: [embed] });

            // Log تغيير الاسم
            const ticketInfo = db.ticketData.get(interaction.channel.id);
            const ticketNum = ticketInfo?.ticketNumber || 'unknown';

            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.WARNING)
                .setTitle('✏️ تغيير اسم التذكرة')
                .addFields(
                    { name: 'الرقم', value: `#${ticketNum}`, inline: true },
                    { name: 'القناة', value: `${interaction.channel}`, inline: true },
                    { name: 'الاسم القديم', value: oldName, inline: true },
                    { name: 'الاسم الجديد', value: newName, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, logEmbed).catch(console.error);

            await interaction.reply({ content: '✅ تم', ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: '❌ خطأ', ephemeral: true });
        }
    }

    // Delete modal
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'delete_modal') {
        const confirm = interaction.fields.getTextInputValue('confirm');
        if (confirm !== 'حذف') {
            return await interaction.reply({ content: '❌ لم يتم التأكيد', ephemeral: true });
        }

        const channel = interaction.channel;
        const ticketInfo = db.ticketData.get(channel.id);
        const ticketNum = ticketInfo?.ticketNumber || 'unknown';
        const ownerId = ticketInfo?.ownerId;
        
        if (ownerId) {
            db.activeTickets.delete(ownerId);
        }
        db.ticketData.delete(channel.id);
        db.claimedTickets.delete(channel.id);
        saveData();

        const embed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setDescription(`🗑️ **تم حذف التذكرة بواسطة <@${interaction.user.id}>**`)
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });

        // Log حذف التذكرة
        const logEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle('🗑️ حذف تذكرة')
            .addFields(
                { name: 'الرقم', value: `#${ticketNum}`, inline: true },
                { name: 'القناة', value: channel.name, inline: true },
                { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
        await sendLog(client, logEmbed).catch(console.error);

        setTimeout(() => channel.delete().catch(() => {}), 3000);
    }

    // Close modal
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'close_modal') {
        const reason = interaction.fields.getTextInputValue('reason');
        const channel = interaction.channel;
        
        const ticketInfo = db.ticketData.get(channel.id);
        const ownerId = ticketInfo?.ownerId;
        const ticketNum = ticketInfo?.ticketNumber || 'unknown';

        // قفل القناة فوراً
        try {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                SendMessages: false
            });
            
            if (ownerId) {
                await channel.permissionOverwrites.edit(ownerId, {
                    SendMessages: false
                });
            }
        } catch (e) {
            console.error('Error locking channel:', e);
        }

        // إنشاء صف الأزرار المعطلة بعد الإغلاق
        const lockedRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('reopen_ticket')
                    .setLabel('🔓 إعادة فتح')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('delete_ticket')
                    .setLabel('🗑️ حذف التكت')
                    .setStyle(ButtonStyle.Danger)
            );

        // تحديث الرسالة الأصلية بتعطيل الأزرار
        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            const ticketMessage = messages.find(m => 
                m.author.id === client.user.id && 
                m.components.length > 0
            );
            
            if (ticketMessage) {
                await ticketMessage.edit({ components: [lockedRow] });
            }
        } catch (e) {
            console.error('Error updating buttons:', e);
        }

        const closeEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle('🔒 إغلاق التذكرة')
            .setDescription(`تم قفل التذكرة. يمكن للإدارة حذفها عند الحاجة...`)
            .addFields(
                { name: '📝 السبب', value: reason },
                { name: '👤 أغلقها', value: `<@${interaction.user.id}>` }
            )
            .setTimestamp();
        await interaction.reply({ embeds: [closeEmbed] });

        try {
            // Log إغلاق التذكرة
            const logEmbed = new EmbedBuilder()
                .setColor(COLORS.DANGER)
                .setTitle('🔒 إغلاق تذكرة')
                .addFields(
                    { name: 'الرقم', value: `#${ticketNum}`, inline: true },
                    { name: 'القناة', value: channel.name, inline: true },
                    { name: 'السبب', value: reason, inline: true },
                    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, logEmbed).catch(console.error);

            // Transcript
            const transcript = await createTranscript(channel, `<@${interaction.user.id}>`, reason);
            if (CONFIG.TRANSCRIPT_CHANNEL_ID) {
                const ch = await client.channels.fetch(CONFIG.TRANSCRIPT_CHANNEL_ID);
                if (ch) {
                    await ch.send({
                        content: `📝 ترانسكربت #${ticketNum}`,
                        files: [{ attachment: Buffer.from(transcript), name: `ticket-${channel.name}.html` }]
                    });
                }
            }

            // إرسال التقييم للمستخدم في DM
            if (ownerId) {
                const owner = await client.users.fetch(ownerId).catch(() => null);
                if (owner) {
                    const dmClose = new EmbedBuilder()
                        .setColor(COLORS.DANGER)
                        .setTitle('🔒 تم إغلاق تذكرتك')
                        .setDescription(`تذكرتك **#${ticketNum}** تم إغلاقها`)
                        .addFields(
                            { name: 'السبب', value: reason },
                            { name: 'بواسطة', value: `<@${interaction.user.id}>` }
                        )
                        .setTimestamp();
                    await owner.send({ embeds: [dmClose] }).catch(() => {});

                    const ratingDmEmbed = new EmbedBuilder()
                        .setColor(COLORS.PRIMARY)
                        .setTitle('⭐ تقييم الخدمة')
                        .setDescription('كيف كانت تجربتك؟ اضغط على عدد النجوم:');
                    
                    const ratingRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId(`rate_comment_${ticketNum}_${ownerId}_1`).setLabel('1 ⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`rate_comment_${ticketNum}_${ownerId}_2`).setLabel('2 ⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`rate_comment_${ticketNum}_${ownerId}_3`).setLabel('3 ⭐').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`rate_comment_${ticketNum}_${ownerId}_4`).setLabel('4 ⭐').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`rate_comment_${ticketNum}_${ownerId}_5`).setLabel('5 ⭐').setStyle(ButtonStyle.Success)
                        );

                    await owner.send({ embeds: [ratingDmEmbed], components: [ratingRow] }).catch(() => {});
                }

                db.activeTickets.delete(ownerId);
                db.claimedTickets.delete(channel.id);
                saveData();

                stats.totalClosed = (stats.totalClosed || 0) + 1;
                stats.staffStats[interaction.user.id] = stats.staffStats[interaction.user.id] || { claimed: 0, closed: 0 };
                stats.staffStats[interaction.user.id].closed += 1;
                saveStats();
            }

        } catch (e) {
            console.error(e);
        }
    }


    // rate_comment_ => فتح modal للتعليق الإلزامي
    if (interaction.isButton() && interaction.customId.startsWith('rate_comment_')) {
        try {
            const parts = interaction.customId.split('_');
            if (parts.length < 5) return await interaction.reply({ content: '❌ خطأ في بيانات التقييم', ephemeral: true });
            const ticketNum = parts[2];
            const ownerId = parts[3];
            const rating = parseInt(parts[4]);

            if (interaction.user.id !== ownerId)
                return await interaction.reply({ content: '❌ فقط صاحب التذكرة يمكنه التقييم!', ephemeral: true });
            if (isNaN(rating) || rating < 1 || rating > 5)
                return await interaction.reply({ content: '❌ تقييم غير صالح', ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId(`rating_modal_${ticketNum}_${ownerId}_${rating}`)
                .setTitle(`⭐ تقييم التذكرة #${ticketNum} — ${rating}/5`);

            const commentInput = new TextInputBuilder()
                .setCustomId('rating_comment')
                .setLabel('تعليقك على الخدمة (إلزامي)')
                .setPlaceholder('اكتب تعليقك هنا...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(500);

            modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
            await interaction.showModal(modal);
        } catch (err) {
            console.error('Rating modal error:', err);
            if (!interaction.replied && !interaction.deferred)
                await interaction.reply({ content: '❌ حدث خطأ', ephemeral: true }).catch(() => {});
        }
    }

    // معالجة modal التقييم
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('rating_modal_')) {
        try {
            const parts = interaction.customId.split('_');
            const ticketNum = parts[2];
            const ownerId = parts[3];
            const rating = parseInt(parts[4]);
            const comment = interaction.fields.getTextInputValue('rating_comment');

            await interaction.deferUpdate();

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rated_disabled').setLabel(`تم التقييم: ${rating}/5 ⭐`).setStyle(ButtonStyle.Success).setDisabled(true)
            );

            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('⭐ شكراً لتقييمك!').setDescription(`تقييمك: **${rating}/5** ⭐\n📝 **تعليقك:** ${comment}\n\nشكراً على استخدام نظام التذاكر!`).setTimestamp()],
                components: [disabledRow]
            });

            const ratingEmbed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('⭐ تقييم جديد')
                .addFields(
                    { name: '🎫 رقم التذكرة', value: `#${ticketNum}`, inline: true },
                    { name: '⭐ التقييم', value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true },
                    { name: '👤 المستخدم', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 التعليق', value: comment, inline: false },
                    { name: '📅 التاريخ', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: '𝐍𝐞𝐱𝐮𝐬 𝐑𝐨𝐥𝐞𝐏𝐥𝐚𝐲 • نظام التقييمات' })
                .setTimestamp();

            const ratingsChannel = await client.channels.fetch(CONFIG.RATINGS_CHANNEL_ID).catch(() => null);
            if (ratingsChannel) await ratingsChannel.send({ embeds: [ratingEmbed] });
            else await sendLog(client, ratingEmbed);

            stats.totalRatings = (stats.totalRatings || 0) + 1;
            stats.ratingSum = (stats.ratingSum || 0) + rating;
            stats.averageRating = stats.ratingSum / stats.totalRatings;
            saveStats();
        } catch (err) {
            console.error('Rating submit error:', err);
        }
    }

    // 🔓 إعادة فتح التكت
    if (interaction.isButton() && interaction.customId === 'reopen_ticket') {
        const member = interaction.member;
        if (!hasPermission(member))
            return interaction.reply({ content: '❌ ليس لديك صلاحية!', ephemeral: true });

        const channel = interaction.channel;
        const ticketInfo = db.ticketData.get(channel.id);
        const ownerId = ticketInfo?.userId || ticketInfo?.ownerId;

        try {
            if (ownerId) {
                await channel.permissionOverwrites.edit(ownerId, {
                    ViewChannel: true, SendMessages: true, ReadMessageHistory: true
                });
            }

            const reopenedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✋'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                new ButtonBuilder().setCustomId('rename_ticket').setLabel('تغيير الاسم').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('add_user').setLabel('إضافة عضو').setStyle(ButtonStyle.Secondary).setEmoji('➕')
            );

            const messages = await channel.messages.fetch({ limit: 15 });
            const ticketMsg = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
            if (ticketMsg) await ticketMsg.edit({ components: [reopenedRow] });

            await interaction.reply({
                embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('🔓 إعادة فتح التكت').setDescription(`تم إعادة فتح التكت بواسطة <@${interaction.user.id}>`).setTimestamp()]
            });

            const logEmbed = new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('🔓 إعادة فتح تذكرة')
                .addFields({ name: 'القناة', value: channel.name, inline: true }, { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true })
                .setTimestamp();
            await sendLog(client, logEmbed).catch(console.error);
        } catch (e) {
            console.error('Reopen error:', e);
            await interaction.reply({ content: '❌ حدث خطأ أثناء إعادة الفتح', ephemeral: true });
        }
    }

});

// Cleanup
setInterval(() => {
    for (const [uid, data] of db.activeTickets.entries()) {
        if (!client.channels.cache.get(data.channelId)) {
            db.activeTickets.delete(uid);
            db.ticketData.delete(data.channelId);
            db.claimedTickets.delete(data.channelId);
            saveData();
        }
    }
}, 300000);

process.on('SIGINT', () => { saveData(); process.exit(0); });
process.on('unhandledRejection', console.error);
process.on('uncaughtException', (e) => { console.error(e); saveData(); });

client.login(CONFIG.TOKEN);