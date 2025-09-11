/**
 * scripts/test-tags.ts
 * PURPOSE: Quick sanity check for new Tagging schema
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Create a Tag
  const tag = await prisma.tag.create({
    data: {
      name: "Venture Capital",
      slug: "venture-capital",
      createdBy: "user",
    },
  });
  console.log("✅ Created tag:", tag);

  // 2) Create a Contact (dummy data)
  const contact = await prisma.contact.create({
    data: {
      fullNameEnc: "John Doe (enc)",
      fullNameIdx: "john-doe", // normally HMAC index
      emailEnc: "john@example.com (enc)",
      emailIdx: "john@example.com",
      phoneEnc: null,
      phoneIdx: null,
    },
  });
  console.log("✅ Created contact:", contact);

  // 3) Attach tag to contact
  const contactTag = await prisma.contactTag.create({
    data: {
      contactId: contact.id,
      tagId: tag.id,
      assignedBy: "user",
    },
  });
  console.log("✅ Linked contact to tag:", contactTag);

  // 4) Query back: get contact with tags
  const contactWithTags = await prisma.contact.findUnique({
    where: { id: contact.id },
    include: { tags: { include: { tag: true } } },
  });
  console.log("✅ Contact with tags:", JSON.stringify(contactWithTags, null, 2));

  // 5) Query back: get tag with contacts
  const tagWithContacts = await prisma.tag.findUnique({
    where: { id: tag.id },
    include: { contacts: { include: { contact: true } } },
  });
  console.log("✅ Tag with contacts:", JSON.stringify(tagWithContacts, null, 2));
}

main()
  .catch((e) => {
    console.error("❌ Error in test:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
