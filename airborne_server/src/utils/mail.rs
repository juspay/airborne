use std::sync::Arc;

use lettre::{message::Mailbox, Address, Message, SmtpTransport, Transport};
use log::error;
use tera::Tera;

use crate::{run_blocking, types::ABError};

pub struct Mail<'a> {
    pub smtp_transport: &'a Arc<SmtpTransport>,
    pub tera: &'a Arc<Tera>,
    pub context: tera::Context,
    pub to: String,
    pub subject: String,
    pub text_body_template: String,
    pub html_body_template: Option<String>,
}

impl<'a> Mail<'a> {
    pub fn new(
        smtp_transport: &'a Arc<SmtpTransport>,
        tera: &'a Arc<Tera>,
        context: tera::Context,
        to: String,
        subject: String,
        text_body_template: String,
        html_body_template: Option<String>,
    ) -> Self {
        Mail {
            smtp_transport,
            tera,
            to,
            subject,
            text_body_template,
            html_body_template,
            context,
        }
    }

    pub async fn send(&self) -> Result<(), ABError> {
        let tera = self.tera.clone();
        let context = self.context.clone();
        let text_body_template = self.text_body_template.clone();
        let text_body = run_blocking!({
            tera.render(&text_body_template, &context).map_err(|e| {
                ABError::InternalServerError(format!("Template rendering error: {}", e))
            })
        })?;

        let email_builder = Message::builder()
            .from(Mailbox::new(
                Some("Airborne No Reply".to_owned()),
                "no-reply@airborne.io".parse().unwrap(),
            ))
            .to(Mailbox::new(
                None,
                self.to.parse::<Address>().map_err(|e| {
                    ABError::InternalServerError(format!("Invalid email address: {}", e))
                })?,
            ))
            .subject(self.subject.clone());

        let email = match &self.html_body_template {
            Some(html_body_template) => {
                let tera = self.tera.clone();
                let context = self.context.clone();
                let html_body_template = html_body_template.clone();
                let html_body = run_blocking!({
                    tera.render(&html_body_template, &context).map_err(|e| {
                        ABError::InternalServerError(format!("Template rendering error: {}", e))
                    })
                })?;

                email_builder
                    .multipart(
                        lettre::message::MultiPart::alternative()
                            .singlepart(lettre::message::SinglePart::plain(text_body.clone()))
                            .singlepart(lettre::message::SinglePart::html(html_body.clone())),
                    )
                    .map_err(|e| {
                        ABError::InternalServerError(format!("Email building error: {}", e))
                    })?
            }
            None => email_builder
                .singlepart(lettre::message::SinglePart::plain(text_body.clone()))
                .map_err(|e| {
                    ABError::InternalServerError(format!("Email building error: {}", e))
                })?,
        };

        let mailer = self.smtp_transport.clone();
        let _ = run_blocking!({
            mailer.send(&email).map_err(|e| {
                error!("Could not send email: {:?}", e);
                ABError::InternalServerError(format!("Email sending error: {}", e))
            })
        })?;

        Ok(())
    }
}
