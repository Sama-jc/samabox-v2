/**
 * Test Fixtures for Calendar and iCal RFC 5545 tests
 */

export const GOOGLE_CALENDAR_ICS = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Work Calendar
X-WR-TIMEZONE:UTC
BEGIN:VEVENT
DTSTART:20261102T093000Z
DTEND:20261102T103000Z
DTSTAMP:20261102T080000Z
UID:google-event-12345@google.com
CREATED:20261101T120000Z
DESCRIPTION:Sprint Planning meeting with engineering team.\\nDiscuss V2 release.
LAST-MODIFIED:20261101T120000Z
LOCATION:https://meet.google.com/abc-defg-hij
STATUS:CONFIRMED
SUMMARY:Sprint Planning
TRANSP:OPAQUE
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261103
DTEND;VALUE=DATE:20261104
DTSTAMP:20261102T080000Z
UID:google-allday-67890@google.com
SUMMARY:Company Hackathon
DESCRIPTION:All-day innovation hackathon.
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

export const OUTLOOK_CALENDAR_ICS = `BEGIN:VCALENDAR
METHOD:REQUEST
PRODID:Microsoft Exchange Server 2010
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Eastern Standard Time
BEGIN:STANDARD
DTSTART:16010101T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:outlook-event-99999@microsoft.com
SUMMARY;LANGUAGE=en-US:Quarterly Architecture Review
DESCRIPTION;LANGUAGE=en-US:Reviewing microservices and security architecture.\\n
 Location details inside.
LOCATION:Conference Room B / Microsoft Teams
DTSTART;TZID="Eastern Standard Time":20261102T140000
DTEND;TZID="Eastern Standard Time":20261102T153000
CLASS:PUBLIC
PRIORITY:5
END:VEVENT
END:VCALENDAR`;

export const APPLE_CALENDAR_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//Mac OS X 10.15.7//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
CREATED:20261101T100000Z
UID:apple-event-77777@apple.com
DTSTAMP:20261101T100000Z
SUMMARY:Security Sync & Audit\\, Team 1
DTSTART;TZID=Europe/Madrid:20261102T110000
DURATION:PT45M
DESCRIPTION:Discussing CVE-2026-1234 and remediation steps.\\n
 Bring updated notes\\; remember laptops.
LOCATION:Meeting Room 4 (Main Campus)
END:VEVENT
END:VCALENDAR`;

export const XSS_MALICIOUS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Malicious//EN
BEGIN:VEVENT
UID:xss-attack-1@evil.com
DTSTART:20261102T160000Z
DTEND:20261102T170000Z
SUMMARY:Meeting <script>alert("pwned")</script>Injected
DESCRIPTION:Payload <img src="x" onerror="evil()"/> with <style>body{display:none}</style>styles
LOCATION:Room <iframe src="javascript:alert(1)"></iframe>Secret
END:VEVENT
END:VCALENDAR`;

export const FOLDED_LINES_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:folded-123@test.com
DTSTART:20261102T130000Z
DTEND:20261102T140000Z
SUMMARY:Very long summary title that has been folded
  into multiple lines by the calendar
 	export server
DESCRIPTION:Line 1 of description
  continued on line 2
 	and continued on line 3 with tabs
LOCATION:Building A
  Room 302
END:VEVENT
END:VCALENDAR`;
