# LMS User Guide & Administrator Documentation

Welcome to the Leave Management System (LMS). This guide documents the core features and recent enhancements.

## 1. For Employees

### Applying for Leave
- Navigate to **My Portal**.
- Select the **Leave Type** (PL, CL, SL, or Comp-Off).
- Choose **Start** and **End** dates.
- Provide a **Reason**.
- **Negative Balance**: The system allows applying for leave even if you have a zero balance (up to a configurable limit, typically -5 days). A warning will be shown.
- **Probation Period**: Privilege Leave (PL) cannot be applied during the initial probation period (configurable, typically 6 months).

### Leave Ledger
- View your leave history and running balances in the **Leave Ledger**.
- Note: Some balances (like CL) might be hidden from employees if configured by HR.

### Profile & Security
- Update your **Communication Email** in the Profile page to receive system notifications.
- **Change Password**: You can update your login password from the Profile page.

---

## 2. For HR & Managers

### Team Directory
- View all employees and their current leave balances.
- **Export CSV**: Download the current view of the team directory for reporting.
- **Action Icons**: Use the icons in the rightmost column to:
    - **Edit**: Update employee details, roles, or set their **Last Working Day (LWD)**.
    - **Prorate**: Open the proration calculator or manually trigger leave accruals.
    - **Delete**: Remove an employee from the system.

### Settings & Policy Configuration
- **Policy Config Tab**:
    - **PL Accrual Rate**: Number of days accrued per month (default: 1.5).
    - **Accrual Base Days**: The base working days required for full accrual (default: 20).
    - **Max Carry Forward**: Maximum PL days that can be carried to the next year.
    - **Probation Period**: Duration in months during which PL is restricted.
    - **Negative Leave Limit**: Maximum negative balance allowed.
- **Year-End Closure**: Run this annually to reset CL/SL and process PL carry-forwards.

### Holiday Management
- Manage public holidays in the **Holidays** section.
- Only users with **ADMIN** roles can add, edit, or delete holidays.

### Email Notifications
- System automatically notifies **HR and Managers** via email whenever a new leave request is submitted by an employee.
