import { firestore, seedTenantZero } from "@raas/store";

await seedTenantZero(firestore(), process.env);
console.log("Tenant Zero seeded on the Firestore emulator.");
