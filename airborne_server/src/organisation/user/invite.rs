use uuid::Uuid;

use crate::{run_blocking, types::ABError, utils::db::{
    models::{InviteRole, OrganisationInviteEntry},
    DbPool,
}};

/// Check if there's an existing pending invite for the same org and email
pub async fn find_existing_pending_invite(
    pool: &DbPool,
    org_id: &str,
    email: &str,
    role: &InviteRole,
) -> Result<Option<OrganisationInviteEntry>, diesel::result::Error> {
    let pool = pool.clone();
    let org_id = org_id.to_string();
    let email = email.to_string();
    let role = role.clone();
    
    run_blocking!({
        let mut conn = pool.get().map_err(|e| diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new(e.to_string())
        ))?;
        
        use crate::utils::db::schema::hyperotaserver::organisation_invites;
        use diesel::prelude::*;
        
        Ok(organisation_invites::table
            .filter(organisation_invites::org_id.eq(&org_id))
            .filter(organisation_invites::email.eq(&email))
            .filter(organisation_invites::role.eq(&role))
            .filter(organisation_invites::status.eq(crate::utils::db::models::InviteStatus::Pending))
            .first::<OrganisationInviteEntry>(&mut conn)
            .optional())
    })
    .map_err(|e| diesel::result::Error::DatabaseError(
        diesel::result::DatabaseErrorKind::UnableToSendCommand,
        Box::new(e.to_string())
    ))?
}

/// Update an existing invite's token and created_at timestamp
pub async fn update_existing_invite(
    pool: &DbPool,
    invite_id: Uuid,
    new_token: String,
) -> Result<OrganisationInviteEntry, diesel::result::Error> {
    let pool = pool.clone();
    
    run_blocking!({
        let mut conn = pool.get().map_err(|e| diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new(e.to_string())
        ))?;
        
        use crate::utils::db::schema::hyperotaserver::organisation_invites;
        use diesel::prelude::*;
        use chrono::Utc;
        
        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set((
                organisation_invites::token.eq(new_token),
                organisation_invites::created_at.eq(Utc::now()),
            ))
            .get_result::<OrganisationInviteEntry>(&mut conn))
    })
    .map_err(|e| diesel::result::Error::DatabaseError(
        diesel::result::DatabaseErrorKind::UnableToSendCommand,
        Box::new(e.to_string())
    ))?
}

/// Insert a new invite into the database
pub async fn create_new_invite(
    pool: &DbPool,
    org_id: String,
    email: String,
    role: InviteRole,
    token: String,
) -> Result<OrganisationInviteEntry, diesel::result::Error> {
    let pool = pool.clone();
    
    run_blocking!({
        let mut conn = pool.get().map_err(|e| diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new(e.to_string())
        ))?;
        
        use crate::utils::db::schema::hyperotaserver::organisation_invites;
        use diesel::prelude::*;
        use chrono::Utc;
        
        let new_invite = OrganisationInviteEntry {
            id: Uuid::new_v4(),
            org_id,
            email,
            role,
            token,
            status: crate::utils::db::models::InviteStatus::Pending,
            created_at: Utc::now(),
        };
        
        Ok(diesel::insert_into(organisation_invites::table)
            .values(&new_invite)
            .get_result::<OrganisationInviteEntry>(&mut conn))
    })
    .map_err(|e| diesel::result::Error::DatabaseError(
        diesel::result::DatabaseErrorKind::UnableToSendCommand,
        Box::new(e.to_string())
    ))?
}

/// Generate a secure random token for invite links
pub fn generate_invite_token() -> String {
    use rand::{distributions::Alphanumeric, Rng};
    
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}