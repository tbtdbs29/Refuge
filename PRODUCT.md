# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js (Express) + SQLite, chosen by the user. Public pages rendered server-side (SEO), back office in the same app, uploaded photos stored on disk. Target hosting: a small VPS or a Node PaaS (Render, Railway, Fly.io).

## Users

- **Future adopters** (families, couples, retirees around Landerneau / Finistère nord), mostly on phone, browsing animals looking for a match, then contacting the shelter by email or phone. Cats live in foster families, so cat requests go by email only.
- **Supporters**: donors, volunteers (dog walkers), visitors of the yearly kermesse, people following news.
- **Shelter volunteers and staff** (several accounts): publish and update animal listings, mark animals adopted, manage the events calendar, write news, update shelter info and adoption fees, read contact requests. Not technical users.

## Product Purpose

Replace the old Overblog blog of the Refuge Animalier du Pays de Landerneau with a modern site that gets animals adopted faster and helps the shelter raise support (donations, volunteering, memberships), with a back office volunteers can use without help.

Success: an adopter finds an animal matching their home in a few taps and knows exactly how to apply; a volunteer publishes a new animal in under two minutes.

## Positioning

A small independent local shelter in Landerneau (Finistère), run with very few staff and many volunteers, working with foster families (around 200 cats in foster care) and a partner Spanish association for dog rescues. It also takes in farm animals (goats, Ouessant sheep) and NACs. Over 13 000 animals rehomed since its creation (stated by the shelter itself).

## Operating Context

- Address: 8, rue Saint Ernel (ex rue du Calvaire), 29800 Landerneau. Tel 02 98 21 57 27. Email refugedelanderneau@yahoo.fr.
- Open every day 10h-12h and 14h-17h30.
- Adoption requires the certificat d'engagement (décret du 18 juillet 2022) signed 7 days before adoption, for dogs, cats, rabbits, ferrets.
- Adoption fees (real, from the old site) for dogs, cats and other animals; doyen contract with 30 Millions d'Amis for animals over 10.
- Help: membership card, tax-deductible donations (66 %, CERFA), in-kind donations (leashes, blankets, food, stainless bowls, office furniture, cleaning products), volunteering (dog walks every day), collecting copper coins, shop items (bandanas, keepkeys).
- Recurring events: yearly kermesse, cat adoption days (e.g. at Point DOG Brest), volunteers' evening.

## Capabilities and Constraints

- Public: animal listings by species (chiens, chats, NACs, animaux de ferme), animal detail, adopted album, news, events calendar, adoption fees and process, how to help, contact form.
- Back office: multi-user with roles (admin manages accounts, editor manages content); animals CRUD with photos and status (à l'adoption, réservé, adopté, SOS); calendar events CRUD; news CRUD; contact messages inbox; shelter info and fees editable.
- French only.
- Initial animal data is sample data chosen by the user; real photos will be uploaded through the back office.

## Brand Commitments

- Name: Refuge Animalier du Pays de Landerneau. No existing logo worth preserving (old site is an Overblog theme).
- Requested feel: cute, pretty, and professional, with animations.

## Evidence on Hand

- Real facts above (address, hours, fees, help options, certificat d'engagement).
- No real animal photos in the project: sample animals are fictional and must be labelled as examples until replaced. No testimonials, no partner logos, no figures beyond "13 000 adoptions" may be invented.

## Product Principles

1. The animal comes first: every listing must make the animal's character and needs readable at a glance.
2. Make the next step obvious: how to adopt, whom to write to, what to prepare.
3. Volunteers are not webmasters: the back office must be forgiving, plain French, and fast on a phone.
4. Honest and warm: no guilt-tripping, no invented proof.

## Accessibility & Inclusion

Older adopters and volunteers: generous text size, strong contrast, large tap targets, motion that respects prefers-reduced-motion.
