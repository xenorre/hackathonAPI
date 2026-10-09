# 0001. Hackathon CRUD

**Date**: 2026-10-09
**Status**: Proposed

## Summary

Administrators can create, update, and delete hackathons. Signed in users can list and read them, and participants can join active hackathons that have not ended. The existing Better Auth integration controls access, and creation records the signed in administrator as author.

## Context

The project already has a Hackathon model, an empty feature module, a create DTO, and global authentication and response formatting. This feature completes that existing API without changing the database schema. Read access assumes login is required, matching the current user endpoints.

## Requirements

As an administrator, I can manage hackathons. As a signed in user, I can browse them.

1. **AC-1**: GET `/hackathon` and GET `/hackathon/:id` return records to either role and reject unauthenticated requests with 401.
2. **AC-2**: POST `/hackathon`, PATCH `/hackathon/:id`, and DELETE `/hackathon/:id` require ADMIN. Other authenticated roles receive 403 before database access.
3. **AC-3**: Creation validates the existing DTO, transforms dates, maps `startAt` to `startDate` and `endsAt` to `endDate`, and sets `authorId` from `session.user.id`. Client supplied identifiers and authors cannot override stored values.
4. **AC-4**: PATCH accepts partial create fields, preserves omitted values and the original author, and validates supplied values. Null cannot clear required fields. The nullable description can be cleared; null optional `isActive` is treated as omitted, matching the existing create DTO.
5. **AC-5**: Missing reads, updates, and deletes return 404. Update and delete handle Prisma P2025 directly so a concurrent deletion also returns 404. Other database errors propagate.
6. **AC-6**: Write responses include `Hackathon created successfully`, `Hackathon updated successfully`, or `Hackathon deleted successfully` through the existing response interceptor. POST returns 201; other successful operations return 200.
7. **AC-7**: POST `/hackathon/:id/join` requires PARTICIPANT. Missing sessions receive 401, and administrators receive 403 before database access.
8. **AC-8**: Joining a missing hackathon returns 404. Inactive hackathons and hackathons whose stored `endDate` is less than or equal to the current time return 400 without creating participation.
9. **AC-9**: Joining inserts a HackathonParticipant with the route hackathon ID and session user ID. The existing unique constraint on both IDs prevents duplicates, including concurrent requests; Prisma P2002 becomes BadRequestException and other database errors propagate.
10. **AC-10**: Successful joins return the created participant record with HTTP 201 and `Hackathon joined successfully` through the existing response interceptor. No request body is required, and client supplied IDs cannot override the route or session.

## Options considered

Existing global authentication with method role decorators uses the established integration and avoids duplicate guard execution. Its dependency is the application's existing global auth registration.

An explicit auth guard on this controller makes the dependency visible locally but would repeat global guard execution and session lookup.

## Decision

Use the existing global Better Auth guard with `@Roles(['ADMIN'])` on CRUD write methods, `@Roles(['PARTICIPANT'])` on join, and `@Session()` for trusted user IDs. Keep database operations in the injected HackathonService. Use PartialType with null validation enabled for required fields. Return database scalar fields using the existing response envelope.

## Rationale

These choices match the existing user feature and Nest dependency injection. Explicit field mapping preserves the API's requested date names and prevents request bodies from overwriting server controlled fields. Direct mutation error handling avoids a separate existence check that can become stale.

## Feature design

The existing Hackathon has a generated string ID, required name and dates, nullable description, active flag defaulting to true, database timestamps, and a required author relationship to User. Delete uses the existing database cascade for participant records.

The existing HackathonParticipant has a generated ID, hackathon ID, user ID, and generated join timestamp. Its unique constraint on hackathon ID and user ID is the duplicate protection. Joining checks the hackathon before insertion and relies on this database constraint rather than a separate duplicate lookup. Joining before the start date is allowed.

| Endpoint              | Method | Inputs                         | Output                       | Access      | Errors             |
| --------------------- | ------ | ------------------------------ | ---------------------------- | ----------- | ------------------ |
| `/hackathon`          | GET    | None                           | Hackathon array              | Signed in   | 401                |
| `/hackathon/:id`      | GET    | ID                             | Hackathon                    | Signed in   | 401, 404           |
| `/hackathon`          | POST   | CreateHackathonDto             | Created Hackathon            | ADMIN       | 400, 401, 403      |
| `/hackathon/:id`      | PATCH  | ID, partial CreateHackathonDto | Updated Hackathon            | ADMIN       | 400, 401, 403, 404 |
| `/hackathon/:id`      | DELETE | ID                             | Deleted Hackathon            | ADMIN       | 401, 403, 404      |
| `/hackathon/:id/join` | POST   | Route ID, session user ID      | Created HackathonParticipant | PARTICIPANT | 400, 401, 403, 404 |

| Value                                          | Source                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| Name, description, active flag, supplied dates | Validated request DTO                                |
| Author ID on create                            | Better Auth session user ID                          |
| Lookup and mutation ID                         | Route parameter                                      |
| Generated ID, default active flag, timestamps  | Existing database model                              |
| Read and write response fields                 | Prisma Hackathon result                              |
| Write message and status                       | ResponseMessage metadata and Nest route defaults     |
| Participation hackathon ID and user ID         | Route parameter and Better Auth session              |
| Participation ID and join timestamp            | Existing database defaults                           |
| Join eligibility                               | Stored isActive and endDate compared with Date.now() |

All administrators may modify any hackathon. Reads include active and inactive records. Listing follows the existing user API's unpaginated behavior. No new configuration is needed.

Critical scenarios cover each role and unauthenticated access (AC-1, AC-2), date transformation and author spoofing (AC-3), partial updates (AC-4), missing records and database error propagation (AC-5), and response messages (AC-6).

Join scenarios cover role restrictions (AC-7), missing, inactive, ended, and exact end time cases (AC-8), insertion and duplicate constraint errors (AC-9), and session attribution and response fields (AC-10).

## Build plan

1. Implement the read service and routes, fixing feature import extensions needed for registration (AC-1, AC-5).
2. Add creation, session author mapping, and write permissions and response messages (AC-2, AC-3, AC-6).
3. Add the partial update DTO and direct update and delete error handling (AC-2, AC-4, AC-5, AC-6).
4. Verify service behavior and real HTTP requests through the existing auth integration, global validation settings, and response interceptor (AC-1 through AC-6).
5. Implement participant joins and verify eligibility, unique constraint handling, trusted session attribution, and HTTP responses (AC-7 through AC-10).

The default delivery approach is small complete API paths because the project records no other approach.

## Consequences

The feature reuses existing infrastructure and needs no schema migration. Input date names differ from stored and returned names, so mapping remains explicit. The list can grow without a page limit, matching the existing API; pagination can be added when its client contract is defined.
