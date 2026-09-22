# Zero-cost hosting on EC2 and Neon, with an expiry date

Pill-Facts is a personally funded portfolio project that must cost nothing to run, and
must also credibly say "AWS". Those two goals conflict: AWS has no permanent free tier
any more. Accounts opened after 15 July 2025 get a six-month plan with $200 of credits;
older accounts get twelve months of t2/t3.micro from their creation date. Either way the
clock runs out.

The backend runs on an EC2 t3.micro and Postgres runs on Neon's free tier rather than on
the same box, because 1GB of RAM will not comfortably hold a JVM, Postgres and a
reverse proxy at once. The frontend is on Cloudflare Pages. Neon rather than Supabase
because Supabase free projects pause after a week of inactivity, which is precisely what
a portfolio site experiences. Render was rejected outright: its free tier sleeps after
15 minutes and Spring Boot takes 30–50 seconds to wake, on the one URL being posted
publicly.

## Consequences

Two operational obligations that are invisible in the code: a billing alarm at $1, and a
calendar reminder for the free-tier expiry with a migration path to Koyeb, whose free
tier is always-on. The JVM needs tuning for the 1GB ceiling.
