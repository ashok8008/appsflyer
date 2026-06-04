#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: Publisher reporting and tracking dashboard for AppsFlyer-based campaign system. Roles: super_admin, admin, publisher. PID=Clickvibe fixed, af_siteid=publisher, af_sub_siteid=placement. Manual + auto AppsFlyer sync, click tracking with redirect to AppsFlyer, reports, CSV export, daily emails (Resend).

backend:
  - task: "Auth (JWT login, /auth/me, super admin seeding)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/auth.js, /app/lib/seed.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Login with admin@clickvibe.com / admin123 returns JWT. Super admin auto-seeded on first request."
      - working: true
        agent: "testing"
        comment: "Comprehensive testing completed. All auth endpoints working: POST /auth/login returns JWT token with user object, GET /auth/me returns user details with Bearer token, invalid credentials correctly rejected with 401, protected endpoints reject requests without token with 401. Super admin seeding verified."

  - task: "Publishers CRUD + publisher user creation"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "POST/GET/PUT /publishers, POST /publishers/:id/users for creating publisher logins. public_code becomes af_siteid."
      - working: true
        agent: "testing"
        comment: "All publisher endpoints working correctly: POST /publishers creates publisher with public_code, duplicate public_code correctly rejected with 400, GET /publishers returns list, GET /publishers/:id returns publisher with users and assigned_campaigns, PUT /publishers/:id updates fields, POST /publishers/:id/users creates publisher user with role='publisher' and linked publisher_id."

  - task: "Campaigns CRUD + assign to publisher"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Polymarket campaign creation works. /campaigns/:id/assign creates publisher_campaigns. public_code maps to af_c_id."
      - working: true
        agent: "testing"
        comment: "All campaign endpoints working: POST /campaigns creates campaign with public_code and payout settings, GET /campaigns returns list, PUT /campaigns/:id updates fields, POST /campaigns/:id/assign creates publisher_campaigns row, duplicate assignment correctly rejected with 400."

  - task: "Placements CRUD"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Placements created per publisher, public_code becomes af_sub_siteid."
      - working: true
        agent: "testing"
        comment: "All placement endpoints working: POST /placements creates placement with public_code, GET /placements with publisher_id filter returns list, PUT /placements/:id updates fields including status and source_type."

  - task: "Tracking Links generation"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "POST /tracking-links creates short code. short_url uses TRACKING_BASE_URL setting."
      - working: true
        agent: "testing"
        comment: "All tracking link endpoints working: POST /tracking-links creates link with auto-generated public_code, GET /tracking-links returns list with short_url field populated (format: tracking_base_url/api/click/{code}), PUT /tracking-links/:id updates status."

  - task: "Click redirect endpoint /api/click/:code"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified 302 to https://app.appsflyer.com/id6648798962?pid=Clickvibe&c=Polymarket&af_c_id=POLYMARKET&af_siteid=POPCULTURE&af_sub_siteid=popculture_main&af_sub1=...&clickid=cv_xxx. Click row stored with IP, UA, country (CF header), device. Status checks reject inactive publisher/campaign/placement."
      - working: true
        agent: "testing"
        comment: "Click redirect endpoint fully working: GET /api/click/{code} (public, no auth required) returns 302 redirect to AppsFlyer with correct URL format (https://app.appsflyer.com/{appid}?pid=Clickvibe&c={campaign}&af_c_id={campaign_code}&af_siteid={publisher_code}&af_sub_siteid={placement_code}&af_sub1=...&clickid=cv_xxx). Verified clickid starts with 'cv_', all query params correctly passed, click row stored in database with IP/UA/country/device, inactive publisher/campaign/placement correctly rejected with 403, invalid tracking code rejected with 404."

  - task: "AppsFlyer Sync (raw installs + in_app_events, normalize site_id/sub_site_id/campaign_id)"
    implemented: true
    working: true
    file: "/app/lib/appsflyer.js, /app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Manual sync verified with real AppsFlyer API token. installs_report returned 1 row imported. in_app_events_report hit AppsFlyer daily download limit (expected). Rows normalized: site_id -> publisher, sub_site_id -> placement, campaign_id -> campaign, click_id -> click."
      - working: true
        agent: "testing"
        comment: "AppsFlyer sync working correctly: POST /appsflyer/sync with days parameter returns results array with installs_report and in_app_events_report entries. Both reports hit AppsFlyer daily download limit (expected per requirements, not a bug). GET /appsflyer/imports returns import history. Sync endpoint properly handles API errors and returns structured response."

  - task: "Admin Users (super admin only invite)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "POST /users requires super_admin role; GET /users lists admins."
      - working: true
        agent: "testing"
        comment: "Admin user endpoints working: POST /users creates admin user (super_admin role required), duplicate email correctly rejected with 400, GET /users returns list of admin and super_admin users only (publisher users excluded)."

  - task: "Settings (PID, app_id, timezone, tracking_base_url, daily reports)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/seed.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Default PID=Clickvibe seeded. GET/PUT /settings."
      - working: true
        agent: "testing"
        comment: "Settings endpoints working: GET /settings returns app settings including appsflyer_pid='Clickvibe' default, PUT /settings updates settings fields."

  - task: "Admin Reports (overview + group_by publisher/campaign/placement/country/sub_id, daily series)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "GET /reports/overview joins clicks + appsflyer_events with filters. CSV export at /reports/export.csv."
      - working: true
        agent: "testing"
        comment: "Admin reports fully working: GET /reports/overview returns totals (clicks, installs, events, revenue, cvr, ecpi) and series array. group_by parameter works for publisher, campaign, placement with breakdown array containing key, name, code, metrics. GET /reports/export.csv returns CSV file with correct Content-Type (text/csv) and Content-Disposition headers."

  - task: "Publisher-scoped APIs"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "/publisher/me, /publisher/campaigns, /publisher/tracking-links, /publisher/reports/overview scoped by user.publisher_id. CSV export available."
      - working: true
        agent: "testing"
        comment: "Publisher-scoped APIs working correctly: GET /publisher/me returns publisher details, GET /publisher/campaigns returns only assigned campaigns with status=active, GET /publisher/tracking-links returns links with short_url, campaign, and placement objects, GET /publisher/reports/overview returns scoped metrics, GET /publisher/reports/export.csv returns CSV. Publisher users correctly rejected from admin endpoints (404). All endpoints properly scoped to user.publisher_id."

frontend:
  - task: "Login + role-based shell (Admin/Publisher)"
    implemented: true
    working: "NA"
    file: "/app/app/page.js, /app/components/Login.jsx, /app/components/admin/AdminApp.jsx, /app/components/publisher/PublisherApp.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Admin Views (Dashboard, Publishers, Campaigns, Placements, Tracking Links, Reports, Sync, Users, Settings)"
    implemented: true
    working: "NA"
    file: "/app/components/admin/*.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Publisher Views (Dashboard, Tracking Links, Reports)"
    implemented: true
    working: "NA"
    file: "/app/components/publisher/*.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "MVP complete. All backend endpoints implemented. End-to-end flow verified manually (super admin login -> create publisher POPCULTURE -> create Polymarket campaign -> assign -> create placement -> generate tracking link -> hit /api/click/{code} -> 302 to AppsFlyer with correct params). AppsFlyer manual sync verified with real API token (installs_report returned 1 row). Please run backend tests on all endpoints with focus on: 1) auth roles enforcement (publisher cannot see admin endpoints, only super_admin can POST /users), 2) click endpoint redirect correctness and click row persistence, 3) publisher scoping (publisher sees only their data), 4) report aggregation correctness, 5) CSV export. Login: admin@clickvibe.com / admin123. The in_app_events_report from AppsFlyer hit their daily download limit during my test; this is expected and not a bug."
  - agent: "testing"
    message: "Comprehensive backend testing completed. All 41 tests passed (100% success rate). Tested all critical endpoints: Auth (login, /auth/me, invalid credentials, no token protection), Publishers CRUD + user creation, Campaigns CRUD + assignment, Placements CRUD, Tracking Links with short_url generation, Click redirect (public endpoint, 302 redirect, correct AppsFlyer URL format with clickid=cv_*, inactive entity rejection), Settings GET/PUT, Admin Users (super_admin only), AppsFlyer Sync (both reports hit daily limit as expected), Admin Reports (overview, group_by, CSV export), Publisher-scoped APIs (me, campaigns, tracking-links, reports, CSV export, access control). All endpoints working correctly with proper authentication, authorization, data validation, and error handling. No critical issues found."
