const fs = require('fs');
const { v4: uuidv4, validate: validateUuid } = require('uuid');

function extractUserIdsFromSql(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const userIds = new Set();

    // Pattern 1: VALUES ('...', 'uuid')
    const pattern1 = /VALUES\s*\(\s*'[^']+',\s*'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'/gi;
    let matches = content.matchAll(pattern1);
    for (const match of matches) {
        const uid = match[1];
        if (isValidUuid(uid)) {
            userIds.add(uid);
        }
    }

    // Pattern 2: ('...', 'uuid')
    const pattern2 = /\(\s*'[^']+',\s*'([a-f0-9-]{36})'/gi;
    matches = content.matchAll(pattern2);
    for (const match of matches) {
        const uid = match[1];
        if (isValidUuid(uid)) {
            userIds.add(uid);
        }
    }

    return userIds;
}

function isValidUuid(uid) {
    try {
        return validateUuid(uid);
    } catch {
        return false;
    }
}

function generateRandomPhone(usedPhones) {
    while (true) {
        const randomDigits = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
        const phone = '0912' + randomDigits;
        if (!usedPhones.has(phone)) {
            usedPhones.add(phone);
            return phone;
        }
    }
}

// Main execution
const userIds = extractUserIdsFromSql('prediction.sql');
console.log(`Number of users found: ${userIds.size}`);

const usedPhones = new Set();
const phoneList = [];

for (const uid of Array.from(userIds).sort()) {
    const phone = generateRandomPhone(usedPhones);
    phoneList.push({ uid, phone });
}

// Write to file
let sqlContent = '';
for (const { uid, phone } of phoneList) {
    sqlContent += `INSERT INTO users (id, phone) VALUES ('${uid}', '${phone}');\n`;
}

fs.writeFileSync('insert_users.sql', sqlContent, 'utf-8');

console.log(`insert_users.sql file created with ${userIds.size} users and unique phone numbers!`);
