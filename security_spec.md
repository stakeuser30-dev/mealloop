# MealLoop Firestore Security Specification

## 1. Data Invariants
1. **User Identity Isolation**: A user may only read and write their own `/users/{userId}` profile document where `userId == request.auth.uid`.
2. **Role Immutability**: Users cannot assign or escalate their own `role` field. Only trusted server-side Admin SDK logic can set roles.
3. **Order Access Control**: Students can only view (`get` / `list`) their own orders where `resource.data.studentUid == request.auth.uid`.
4. **Server-Authoritative Orders & Payments**: Creating orders, mutating payment statuses (`AWAITING_PAYMENT`, `CONFIRMED`, `COLLECTED`), and generating pickup QR tokens (`pickupToken`) are strictly server-side authoritative operations via `server.ts` Firebase Admin SDK. Direct client writes to sensitive order and inventory collections are blocked.
5. **Staff Order Inspection**: Canteen staff and Admins can query orders for their assigned canteen.
6. **Immutable Creation Timestamps**: Timestamps must adhere to `request.time`.

## 2. The Dirty Dozen Payloads (Designed to Attack Identity, Integrity, and State)
1. **Dirty Payload 1 (Role Escalation)**: Attacker sends `{ uid: "attacker123", role: "ADMIN", email: "attacker@campus.edu" }` on user profile update. Expected: `PERMISSION_DENIED`.
2. **Dirty Payload 2 (Identity Spoofing on User)**: User A tries to overwrite `/users/userB` profile. Expected: `PERMISSION_DENIED`.
3. **Dirty Payload 3 (Unauthenticated User Read)**: Unauthenticated visitor tries to read `/users/{userId}`. Expected: `PERMISSION_DENIED`.
4. **Dirty Payload 4 (Direct Order Creation Bypass)**: Attacker attempts direct client write to `/orders/order-999` with `{ status: "CONFIRMED", totalPaise: 0 }` to get free meals without payment. Expected: `PERMISSION_DENIED`.
5. **Dirty Payload 5 (Order Status Tampering)**: Student updates own order from `AWAITING_PAYMENT` to `CONFIRMED`. Expected: `PERMISSION_DENIED`.
6. **Dirty Payload 6 (Snoop Other Students' Orders)**: Student A queries `/orders` without filtering by their own `studentUid`. Expected: `PERMISSION_DENIED`.
7. **Dirty Payload 7 (Fake QR Pickup Token Injection)**: Attacker updates `/orders/{orderId}` with an arbitrary `pickupToken`. Expected: `PERMISSION_DENIED`.
8. **Dirty Payload 8 (Direct Inventory Manipulation)**: Student writes to `/foodItems/{itemId}` setting `stockAvailable: 999`. Expected: `PERMISSION_DENIED`.
9. **Dirty Payload 9 (Group Deal Forgery)**: Client directly updates `/groupDeals/{dealId}` setting `status: "UNLOCKED"` with only 1 participant. Expected: `PERMISSION_DENIED`.
10. **Dirty Payload 10 (NGO Donation Embezzlement)**: Non-NGO user writes to `/donations/{donationId}` claiming food batch. Expected: `PERMISSION_DENIED`.
11. **Dirty Payload 11 (Denial-of-Wallet Path Variable Poisoning)**: Path variable `{orderId}` injected with a 50KB junk unicode string. Expected: `PERMISSION_DENIED`.
12. **Dirty Payload 12 (Ghost Field Injection)**: User updates `/users/{userId}` adding ghost field `{ isSuperAdmin: true, creditsPaise: 1000000 }`. Expected: `PERMISSION_DENIED`.

## 3. Test Runner Specification
All 12 dirty payloads are rejected by Firestore Zero-Trust Security Rules, guaranteeing that direct browser tampering cannot circumvent the authoritative Node.js/Express backend (`server.ts`).
