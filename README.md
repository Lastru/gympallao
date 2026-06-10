# GymPallao

GymPallao is a personal gym companion built as a lightweight Progressive Web App.

The app is designed to be opened from a browser, published through GitHub Pages, and saved to the iPhone Home Screen so it can be used like a regular mobile app.

## Purpose

GymPallao helps track training sessions over time through a visual calendar and customizable workout templates. It is built for quick daily use: create workout plans, assign them to calendar days, update exercise values, and keep a clean history of past training sessions.

## Main features

GymPallao provides a simple calendar-based interface for tracking gym activity over time. Users can create custom workout templates, assign them to specific days, and keep a clear visual record of their training routine.

The app supports multiple workouts per day, customizable workout colors, editable exercise lists, and automatic local saving. It is designed for fast mobile use, with a clean interface, expandable workout cards, swipe actions, and drag-and-drop ordering.

All data is stored locally on the device, with JSON backup export and import available from the settings area.

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
