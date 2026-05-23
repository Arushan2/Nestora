# Authentication Workflow

## Purpose
This workflow defines how users authenticate into Nestora and how their initial role is determined.

## Default User Flow
- A new user registers with standard sign-up fields.
- The system creates the account with the default role set to `user`.
- The user can then sign in normally with their credentials.
- After login, the user can access the functions available to the `user` role.

## Service Provider Enrollment
- During registration, the app provides an option to apply as a service provider.
- If the user selects this option, they must submit additional business or verification documents.
- The account remains in a pending state until the platform approves the provider profile.
- After approval, the user can access service provider functions.

## Product Seller Enrollment
- During registration, the app provides an option to apply as a product seller.
- If the user selects this option, they must submit additional seller or verification documents.
- The account remains in a pending state until the platform approves the seller profile.
- After approval, the user can access product seller functions.

## Admin Authentication
- Admin credentials are predefined in the environment configuration file.
- If a user signs in with the configured admin username and password, the system recognizes the admin account.
- After login, the admin is shown the available admin functions.
- Admin credentials should be managed through environment variables and not hardcoded in the application source.

## Authentication Rules
- Every user signs up and signs in through the normal authentication flow.
- The default role for a new account is `user`.
- Service provider and product seller roles require extra documents and platform approval.
- Admin access is restricted to predefined environment-based credentials.
- Role-based access is shown only after successful login.
