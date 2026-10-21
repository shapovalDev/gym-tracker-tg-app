# Technical Specification: Telegram Mini App for Workout Tracking and Progress Monitoring

## 1. Role and Objective

You are a senior full-stack developer, software architect, and UI/UX designer. Your task is to design and implement a fully functional Telegram Mini App for personal strength training tracking.

The application allows users to create custom workout programs, record the actual results of every set, and analyze exercise progress through charts and statistics.

**Primary objective:** Build a working product with persistent data storage, not merely a prototype, mockup, or demonstration using mock data.

The application is intended for a single user initially, but its architecture must support multiple users without significant redesign.

## 2. Workflow and Implementation Approach

Before starting development:

1. Inspect the existing repository, if available, including its structure, dependencies, documentation, and project rules.
2. If the repository is empty, create the project structure and configure the required technology stack.
3. Review the current official documentation for Telegram Mini Apps and the selected libraries.
4. Create a concise implementation plan and document the main technical decisions.
5. Create the project documentation and proceed with implementation.

Work incrementally in small, verifiable stages. Do not stop after producing a plan.

When a requirement is not explicitly defined, choose the simplest reliable and extensible solution. Do not ask questions about minor implementation details. If external credentials or secrets are required, create configuration templates and continue implementing everything else.

After implementation, run all available checks, fix discovered issues, and provide a final report.

## 3. Technology Stack

Use the following stack unless the existing project provides a compelling reason to retain different technologies:

- **Frontend:** React, TypeScript, Next.js.
- **Backend:** Node.js, TypeScript, REST API.
- **Database:** PostgreSQL via Supabase.
- **ORM:** Prisma.
- **Telegram integration:** Telegram Mini Apps SDK and Telegram Bot API.
- **Validation:** Zod or an equivalent library.
- **Charts:** Recharts or another suitable React charting library.
- **Styling:** Tailwind CSS.
- **Testing:** Vitest and Testing Library; Playwright for critical user journeys.
- **API documentation:** Swagger / OpenAPI.
- **Infrastructure:** Docker, ESLint, Prettier, GitHub Actions.

Additional requirements:

- Use TypeScript in strict mode.
- Follow REST architecture with clear separation of responsibilities.
- Keep business logic out of React components.
- Route all database access and external service integrations through the backend.
- Do not connect the frontend directly to Supabase.
- Never expose secrets or tokens in client-side code.
- Support local development and Docker-based deployment.
- Use compatible, current stable dependency versions.

If a monorepo is justified, organize the project into separate frontend and backend applications, with shared packages for types and validation schemas.

## 4. Core Domain Entities

The application must work with five primary entities:

1. User.
2. Exercise.
3. Workout program and its workouts.
4. Workout session — an actual completed or ongoing workout.
5. Set — a specific exercise result within a workout session.

It is essential to distinguish between the **planned workout** and its **actual execution**. Editing a workout program must not modify the history of previously completed workouts.

## 5. Functional Requirements

### 5.1. Home Screen

The home screen must display:

- The currently active workout program.
- The next workout in the program cycle.
- A "Start Workout" button.
- The date and a brief summary of the last workout.
- The number of workouts completed in the last 7 and 30 days.
- A brief progress summary for selected exercises, if historical data exists.

If no program has been created, display a clear empty state prompting the user to create their first program.

### 5.2. Workout Program Management

Users must be able to:

- Create a program with a name.
- Edit its name and description.
- Create any number of workouts within a program.
- Add, delete, and reorder workouts.
- Add exercises to individual workouts.
- Reorder exercises.
- Remove or edit planned exercises.
- Create multiple programs and switch between them.
- Duplicate a workout or an entire program for convenient editing.
- Archive programs without deleting historical data.

The number of workouts must never be hardcoded. A program can contain one, two, four, six, or any other number of workouts.

Example program:

- Workout A — chest and triceps.
- Workout B — back and biceps.
- Workout C — legs.
- Workout D — shoulders and accessory exercises.

After D, the next workout in the cycle is A.

**Workout cycle logic:**

- The sequence is determined by the program's configured workout order.
- After completing a workout, the application suggests the next workout in the cycle.
- Skipping a workout must not automatically mark it as completed.
- The user can manually select any workout from the program.
- The cycle is not tied to specific weekdays.
- Rest days are allowed and do not change the cycle position.
- Changes to the program's structure or order must not rewrite historical results.

Define predictable behavior when the next workout is deleted or the active program is changed.

### 5.3. Exercise Library

Implement a personal exercise library.

Users must be able to:

- Create exercises with names.
- Assign a target muscle group.
- Add an optional description or technique notes.
- Search exercises by name.
- Filter exercises by muscle group.
- Add existing exercises to multiple workouts.
- Edit and archive exercises.

Do not create globally shared exercises unless necessary. User data must remain isolated.

Archiving an exercise that has already been used must not delete its historical results.

When adding an exercise to a workout, users can optionally specify the planned number of sets and a target repetition range. These values are recommendations, not restrictions on actual performance.

### 5.4. Workout Execution

This is the application's primary screen. It must be optimized for one-handed smartphone use during a workout.

When the user taps "Start Workout":

1. Create a workout session.
2. Display the exercises in the selected workout.
3. Allow the user to open an exercise.
4. Record the results of each set.
5. Allow navigation to the next exercise.
6. Allow the user to finish the workout and save the session.

For each exercise, display:

- Exercise name.
- Planned sets and target repetition range, if configured.
- Results from the previous session for this exercise.
- The list of actual sets recorded in the current session.
- An "Add Set" button.
- Options to edit or delete a set.

For each set, the user must enter:

- Set number.
- Number of repetitions.
- Working weight in kilograms.
- Completion status: completed or skipped, if needed for accurate tracking.

Example:

| Set | Weight | Repetitions |
| --- | -----: | ----------: |
| 1   |  40 kg |          12 |
| 2   |  45 kg |          10 |
| 3   |  45 kg |           9 |
| 4   |  50 kg |           6 |

Do not impose a fixed number of sets. Users must be able to add or remove sets as needed.

Input requirements:

- Numeric fields must be convenient on mobile devices.
- Weight must support decimal values, such as 22.5 kg.
- Repetitions must be a non-negative integer, but a completed working set requires at least one repetition.
- Negative values must be rejected.
- An incomplete set must never be treated as completed.
- Do not automatically record a previous set's weight as a completed result.

**Workout usability requirements:**

- Quickly add the next set.
- Edit incorrectly entered data.
- Display previous results alongside current results.
- Clearly distinguish completed sets.
- Allow the user to end a workout early.
- Confirm completion if there are unfinished sets.
- Allow an unfinished workout to be cancelled without recording it as successfully completed.

All changes must be saved to the server as the user enters them, or through an equally reliable persistence mechanism. Do not keep the only copy of the current workout in browser memory.

If network connectivity is temporarily lost, support local draft persistence and subsequent synchronization where feasible without excessive complexity. Prevent data loss and duplicate sets when requests are retried.

After completing a session, display a summary containing workout duration, completed exercises, total sets, and total training volume.

Duration is measured between the session start and completion timestamps. Label it as total workout duration, not actual time spent under muscular load.

### 5.5. Workout History

Implement a dedicated workout history screen.

Features:

- A chronological list of workout sessions.
- Program and workout names.
- Date, duration, and a brief summary.
- Detailed view of all exercises and sets in a session.
- Filtering by date range.
- Editing incorrectly recorded results.
- Deleting a workout session with confirmation.

Deleting a session must correctly update all related statistics.

Renaming an exercise must not break its relationship with historical results. Use stable identifiers rather than text names for analytics.

### 5.6. Statistics and Progress Charts

Create a dedicated "Progress" section.

The user selects an exercise and a date range, then views charts and statistics based on actual recorded results.

Required metrics:

**1. Maximum Working Weight**

Display the maximum weight used across completed sets in each workout session.

**2. Repetition Progress**

Display repetitions over time. Allow users to analyze results at a selected weight so that incomparable sets are not mixed together.

**3. Training Volume**

Calculate total volume as the sum of weight multiplied by repetitions for all completed sets:

Exercise volume per session = sum of (weight × repetitions).

**4. Estimated One-Rep Max (e1RM)**

Use the Epley formula:

e1RM = weight × (1 + repetitions / 30).

Clearly label this metric as an estimate, not an actual lifted weight. Do not calculate it for sets without a positive working weight and valid repetitions. Use comparable working sets when comparing results.

**5. Personal Records**

Display the best working weight, the best repetition result at a selected weight, and the best estimated e1RM.

Analytics rules:

- All charts must be based on actual data.
- Do not generate artificial data points for days without workouts.
- Do not count planned sets as completed sets.
- Account for edits and deletions of historical data.
- Explain what each metric represents.
- Display a helpful empty state when no historical data exists.
- Do not combine different exercises just because they have identical names if they have different IDs.
- Allow the user to select a period: 30 days, 90 days, one year, or all time.
- Display exact values when a chart point is selected, where supported.
- Charts must be mobile-friendly, with readable labels that are not clipped.

Also display summary statistics: completed workouts, total sets, total training volume, and the change in the selected metric compared with the previous equivalent period.

### 5.7. Units of Measurement

Use kilograms in the MVP.

Store weights using an appropriate numeric representation that supports decimal values. Avoid floating-point types where they could introduce undesirable precision errors.

Design the system so that other units can be added later, but do not introduce unnecessary settings into the MVP.

## 6. Telegram Mini App Integration

The application must open directly inside Telegram through a bot button.

Implement:

- Telegram Bot API integration for launching the application.
- A button that opens the Mini App.
- Authentication using Telegram Mini Apps `initData`.
- Server-side verification of `initData` authenticity.
- User creation or retrieval by Telegram ID after successful verification.
- Authentication on every protected API endpoint.
- Server-side ownership checks for all user data.
- Proper handling of Telegram themes, where supported by the SDK.
- Support for safe areas, mobile keyboards, and responsive layouts.

Do not trust a Telegram ID supplied through an arbitrary client request parameter. Never accept unverified `initData` or use it without server-side verification.

Never expose the Telegram bot token in the frontend.

Provide a secure local development and testing workflow that does not require disabling production authentication. Document HTTPS configuration and the public URL required by Telegram.

## 7. UI/UX Requirements

The interface must look like a modern, dedicated fitness product rather than an administrative spreadsheet.

Core principles:

- Mobile-first design.
- Easy operation during physical exercise.
- Large interactive touch targets.
- Minimal unnecessary navigation.
- High-contrast typography.
- Excellent readability of weights and repetitions.
- Predictable navigation.
- Consistent components and design tokens.
- Animations only when they improve feedback or usability.
- Light and dark theme support, or proper integration with Telegram's theme.
- Loading, error, empty, and success states.
- Accessibility: descriptive field labels, keyboard navigation where applicable, and sufficient contrast.

Main sections:

1. Home.
2. My Programs.
3. Active Workout.
4. History.
5. Progress.
6. Settings.

Design the navigation as appropriate, but avoid unnecessary complexity. The primary action — starting or resuming a workout — must be quickly accessible.

Avoid decorative effects that do not fit the product. Prioritize speed, clarity, and usability during workouts.

## 8. Data Model and Database

Design a normalized Prisma schema containing at least the following entities.

### User

- `id`
- `telegramId` — unique Telegram identifier.
- `createdAt`
- `updatedAt`

### Exercise

- `id`
- `userId`
- `name`
- `muscleGroup` — optional muscle group.
- `description` — optional description.
- `archivedAt` — nullable.
- `createdAt`
- `updatedAt`

### TrainingProgram

- `id`
- `userId`
- `name`
- `description` — nullable.
- `isActive`
- `createdAt`
- `updatedAt`

### ProgramWorkout

- `id`
- `programId`
- `name`
- `position` — workout order within the cycle.
- `createdAt`
- `updatedAt`

### WorkoutExercise

- `id`
- `workoutId`
- `exerciseId`
- `position`
- `plannedSets` — nullable.
- `targetRepsMin` — nullable.
- `targetRepsMax` — nullable.
- `notes` — nullable.
- `createdAt`
- `updatedAt`

### WorkoutSession

- `id`
- `userId`
- `programId` — reference to the program, if applicable.
- `workoutId` — nullable if the workout is not linked to the current plan.
- `status` — `in_progress`, `completed`, or `cancelled`.
- `startedAt`
- `completedAt` — nullable.
- `createdAt`
- `updatedAt`

### SessionExercise

- `id`
- `sessionId`
- `exerciseId`
- `exerciseNameSnapshot` — exercise name captured at the time of the workout.
- `position`
- `createdAt`
- `updatedAt`

### ExerciseSet

- `id`
- `sessionExerciseId`
- `setNumber`
- `weightKg`
- `reps`
- `status` — `completed` or `skipped`.
- `createdAt`
- `updatedAt`

This schema is a starting point. Adjust relationships, names, and constraints where necessary while preserving the required behavior.

Data integrity requirements:

- Every user-owned entity must belong to a specific user.
- All operations on nested entities must verify access to their parent entity.
- Add indexes for user-specific queries and historical lookups.
- Add unique constraints where logically required.
- Use transactions for operations affecting multiple related records.
- Use cascading deletion only where it is safe and expected.
- Normal program editing must not delete historical results.
- Do not use mutable exercise names or workout ordering values as identifiers.
- Define weight rounding rules and valid numeric ranges.
- Include Prisma migrations and document how to apply them.

The server must be able to unambiguously identify a user's active, unfinished session so that it can be restored after a page reload.

## 9. REST API

Design a versioned REST API, for example `/api/v1`.

Provide endpoints for:

- Retrieving the user's profile and application state.
- Creating, updating, activating, and archiving programs.
- Managing workouts within a program.
- Managing exercises.
- Managing exercises within individual workouts.
- Starting workout sessions.
- Retrieving the active session.
- Adding, updating, and deleting sets.
- Adding exercises to an active session.
- Completing or cancelling a session.
- Retrieving workout history.
- Retrieving detailed session information.
- Retrieving analytics and chart time series.
- Retrieving personal records and summary statistics.

Define exact HTTP methods and URLs according to REST conventions.

Requirements:

- Validate all input.
- Use appropriate HTTP status codes.
- Use a consistent error response format.
- Require authentication on every protected route.
- Verify server-side ownership of all accessed data.
- Implement pagination for history.
- Support date-range filtering.
- Prevent duplicate records when operations are retried.
- Document all public endpoints in OpenAPI.

Do not return unnecessary database fields or internal technical error details to the client.

## 10. Security and Reliability

Implement:

- Server-side verification of Telegram `initData`.
- Strict isolation of user data.
- Access checks for programs, workouts, exercises, sessions, and sets.
- Validation of numeric values and status transitions.
- Secure storage of secrets through environment variables.
- Request size and input structure limits.
- Protection against unauthorized modification of records by changing IDs.
- Correct transaction handling.
- Server-side error logging without exposing secrets or sensitive data.
- Network failure handling and safe request retries.
- Prevention of test authentication mechanisms from being used in production.

Do not introduce unnecessary external services, analytics SDKs, advertising SDKs, or collection of personal data that is not required by the application.

## 11. Testing

Write automated tests for critical functionality.

### Unit Tests

- Advancing to the next workout in a cycle.
- Calculating training volume.
- Calculating e1RM.
- Identifying personal records.
- Filtering historical data by date range.
- Validating sets.
- Handling cancelled and unfinished sessions.

### Integration Tests

- Creating a program with an arbitrary number of workouts.
- Adding and editing exercises.
- Creating a session and saving multiple sets.
- Restoring an active session.
- Completing and cancelling workouts.
- Retrieving history and statistics.
- Updating statistics after editing or deleting a result.
- Verifying that users cannot access another user's data.
- Verifying authentication and rejection of invalid Telegram `initData`.

### End-to-End Tests

Verify the complete user journey:

1. The user opens the application.
2. Creates a program with four workouts.
3. Adds exercises.
4. Starts the first workout.
5. Records several sets with different weights and repetitions.
6. Completes the workout.
7. Reloads the application.
8. Sees the saved workout history.
9. Opens the exercise progress section.
10. Sees a chart generated from saved data.
11. Completes the remaining workouts and verifies that the cycle advances from D back to A.

Also test responsive layouts, empty states, network errors, and duplicate request handling.

## 12. Project Documentation

Create and maintain the following files:

- `README.md` — purpose, features, requirements, and quick start.
- `CLAUDE.md` — instructions for Claude Code.
- `docs/architecture/ARCHITECTURE.md` — architecture and key technical decisions.
- `docs/product/PRODUCT.md` — product requirements and MVP scope.
- `docs/api/` — REST API documentation and Swagger/OpenAPI.
- `docs/database/` — data schema and integrity rules.
- `.env.example` — all required environment variables without secrets.
- `docker-compose.yml` — local startup of required services.
- GitHub Actions — linting, type checking, tests, and builds.
- Storybook — shared UI components, provided that setting it up does not delay implementation of the MVP.

Document the commands required to install dependencies, apply migrations, start development, run tests, and build the application.

## 13. Implementation Phases

Divide the work into the following phases.

**Phase 1: Project Foundation**

- Repository structure.
- TypeScript, linting, and formatting configuration.
- PostgreSQL, Prisma, and migrations.
- Environment configuration.
- Telegram authentication.
- Base UI components.

**Phase 2: Programs and Exercises**

- Exercise library.
- Program creation and editing.
- Arbitrary numbers of workouts.
- Reordering workouts and exercises.
- Active program selection.

**Phase 3: Workout Execution**

- Starting and restoring sessions.
- Adding and editing sets.
- Saving results.
- Completing and cancelling sessions.
- Workout history.

**Phase 4: Analytics**

- Metric calculations.
- Time-series queries.
- Progress charts.
- Personal records.
- Summary statistics.

**Phase 5: Quality and Deployment**

- Integration and E2E tests.
- Security checks.
- Responsive design and UX improvements.
- Docker.
- CI.
- Deployment instructions.

After each phase, run the appropriate checks and fix errors before proceeding to the next phase.

## 14. Out of Scope for the MVP

Do not implement the following unless genuinely necessary:

- Social networking or public profiles.
- Friends, subscriptions, and leaderboards.
- An AI coach or automatic workout program generation.
- Nutrition tracking and calorie counting.
- Smartwatch integrations.
- Complex periodization systems.
- Payment processing and subscriptions.
- An administrative dashboard for multiple coaches.
- A complex role-based access control system.
- Push notifications and reminders.

The architecture may support future expansion, but the MVP must remain simple, fast, and reliable.

## 15. Definition of Done

The application is considered complete when:

- It can be started locally using the README instructions.
- Users can open the Mini App through Telegram.
- Telegram authentication is verified on the server.
- Users can create programs with arbitrary numbers of workouts.
- Users can add exercises and change their order.
- Users can complete workouts with arbitrary numbers of sets.
- Each set's weight and repetitions are stored independently.
- Historical data survives page reloads.
- Completed and cancelled workouts are handled correctly.
- The workout cycle advances correctly.
- Charts reflect actual recorded results.
- Statistics are recalculated after editing or deleting data.
- Users cannot access other users' data.
- Critical scenarios are covered by automated tests.
- The project passes linting, type checking, tests, and production builds.
- No critical errors, fake production data, or unfinished placeholders remain in core functionality.
- Documentation allows another developer to deploy and continue developing the project.

## 16. Final Report

When implementation is complete, provide:

1. A summary of implemented features.
2. The project structure.
3. The key architectural decisions.
4. Local setup instructions.
5. A list of required environment variables.
6. Results of linting, type checking, tests, and builds.
7. Instructions for configuring the Telegram bot and publishing the Mini App.
8. Known limitations and any features that could not be implemented.

Do not claim that tests passed unless they were actually executed. Do not claim that the application has been deployed unless deployment was completed.

**Start by inspecting the repository and proceed with implementation. The primary priorities are reliable data persistence, a convenient smartphone workout experience, accurate workout history, and trustworthy progress analytics.**
