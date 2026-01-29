# ZeroSpoilWebsite  
# 🌱 ZeroSpoil — Store‑to‑Store Freshness Network

ZeroSpoil is a front‑end–only prototype to reduce waste by tracking store inventory, flagging near‑expiry items, and redistributing surplus to nearby stores.

- 🔐 **Local-only auth** (Register/Login with SHA‑256 hash; sessions via Web Storage)
- 👤 **Per-user inventory** (`zerospoil_<username>`)
- ♻️ **Redistribution Board** (post + claim; reduces owner stock; deletes only when fully claimed)
- 🔔 **Notifications** (alert all shops on this device/browser profile)
- 📅 **Dates**: Users enter `dd/mm/yyyy` → stored as `yyyy-mm-dd` (ISO) for correct maths & sorting
- 📱 **Responsive**: Mobile-friendly stacked tables
- 💾 **No backend / No DB** — *Local Storage only*

> ⚠️ **Prototype-only**. This is not secure for production (client-only auth and data).
> For a real deployment, add a backend, secure auth, and server-side validation.

---
