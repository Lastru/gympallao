# GymPallao

GymPallao is a personal gym companion built as a lightweight Progressive Web App.

The app is designed to be opened from a browser, published through GitHub Pages, and saved to the iPhone Home Screen so it can be used like a regular mobile app.

## Purpose

GymPallao helps track training sessions over time through a visual calendar and customizable workout templates. It is built for quick daily use: create workout plans, assign them to calendar days, update exercise values, and keep a clean history of past training sessions.

## Main features

- Mobile-first Progressive Web App
- Installable from iPhone Home Screen
- Local-first data storage with IndexedDB
- Calendar view with monthly navigation
- Visual workout tracking by day
- Support for up to three workouts per day
- Calendar cells colored by completed workouts:
  - one workout: full color
  - two workouts: split cell
  - three workouts: three-part split
- Weekly and monthly workout counters
- Custom workout templates
- Custom workout names
- Custom workout colors
- Editable exercise list for each workout template
- Exercise values with flexible input, such as:
  - `80kg`
  - `10km`
  - `30min`
  - `1h30min`
- Current exercise values inferred from the latest valid workout entry
- Historical workout entries preserved independently from future template edits
- Manual editing of past workout entries
- Swipe-to-delete interface
- Drag-and-drop ordering with handles
- Expandable workout cards inside daily logs
- Backup export as JSON
- Backup import with replace or merge mode
- Settings modal with backup tools and calendar legend

## Data model philosophy

Workout templates define the structure of future workouts: name, color, exercise list, and exercise order.

Daily workouts are saved as historical snapshots. This means that changing a workout template later does not automatically rewrite past training sessions.

The main exception is workout color: when a template color is changed, historical calendar colors linked to that workout are updated as well to keep the calendar visually consistent.

Exercise values are dynamic. The app proposes the most recent value for each workout-exercise pair, while still keeping older daily entries unchanged unless edited manually.

## Backup

All data is stored locally on the device. No account or cloud sync is required.

The app includes a JSON backup system:

- Export data to save a local backup file
- Import data by replacing the current database
- Import data by merging only into empty calendar days and missing templates

## Tech stack

- HTML
- CSS
- JavaScript
- IndexedDB
- Service Worker
- Web App Manifest
- GitHub Pages

## Deployment

The app is hosted as a static site through GitHub Pages.
