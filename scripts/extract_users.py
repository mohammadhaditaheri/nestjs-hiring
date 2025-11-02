import re
import uuid
import random

def extract_user_ids_from_sql(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    user_ids = set()

    pattern1 = r"VALUES\s*\(\s*'[^']+',\s*'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'"
    matches = re.finditer(pattern1, content, re.IGNORECASE)
    for m in matches:
        uid = m.group(1)
        if is_valid_uuid(uid):
            user_ids.add(uid)

    pattern2 = r"\(\s*'[^']+',\s*'([a-f0-9-]{36})'"
    matches = re.finditer(pattern2, content, re.IGNORECASE)
    for m in matches:
        uid = m.group(1)
        if is_valid_uuid(uid):
            user_ids.add(uid)

    return user_ids

def is_valid_uuid(uid):
    try:
        uuid.UUID(uid)
        return True
    except:
        return False


user_ids = extract_user_ids_from_sql('prediction.sql')
print(f"Number of users found: {len(user_ids)}")

used_phones = set()
phone_list = []

for uid in sorted(user_ids):
    while True:
        phone = "0912" + "".join([str(random.randint(0, 9)) for _ in range(7)])
        if phone not in used_phones:
            used_phones.add(phone)
            phone_list.append((uid, phone))
            break

with open('insert_users.sql', 'w', encoding='utf-8') as f:
    for uid, phone in phone_list:
        f.write(f"INSERT INTO users (id, phone) VALUES ('{uid}', '{phone}');\n")

print(f"insert_users.sql file created with {len(user_ids)} users and unique phone numbers!")
