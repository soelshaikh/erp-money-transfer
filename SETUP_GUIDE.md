# ERP Money Transfer — Client Setup Guide

---

## Super Admin Access
*(System provider use only)*

| Field      | Value        |
|------------|--------------|
| Company ID | `system`     |
| Username   | `superadmin` |
| Password   | `Admin@1234` |

> Use these credentials to register a new company and create the Head Office account.

---

## Getting Started — Step by Step

---

### Step 1: Company Registration
*(Done by the system provider)*

The system provider logs in as Super Admin and registers your company in the system, then creates your **Head Office account**.

You will receive:
- **Company ID** (e.g. `acme`)
- **Username** (e.g. `headoffice`)
- **Password**

---

### Step 2: Head Office Login

Open the app → enter your **Company ID**, **Username**, and **Password** → tap **Sign In**.

---

### Step 3: Create a Branch
*(Head Office)*

Go to **Branches** → tap **Add Branch** → fill in the branch name and code → tap **Save**.

---

### Step 4: Create a Staff Account
*(Head Office)*

Go to **Users** → tap **Add User** → fill in the name, username, and password → select the branch → tap **Save**.

Share the **Company ID**, **username**, and **password** with the staff member.

---

### Step 5: Staff Login — First Time

Staff opens the app → enters Company ID, username, and password → taps **Sign In**.

They will see a **"Pending Approval"** screen. This is normal — their device needs to be approved before they can access the system.

---

### Step 6: Approve the Device
*(Head Office)*

Go to **Device Approvals** → find the pending request → tap **Approve**.

The staff member's app will automatically update and log them in.

> To **reject** — tap **Reject**. The staff member will be notified and cannot log in from that device.

---

### Step 7: Staff is Ready

After approval, the staff member can log in normally and start creating transactions.

---

**Note:** Each new device requires approval. If a staff member changes their phone, they will go through the approval step again.
