use lettre::{message::Mailbox, Address, Message, SmtpTransport, Transport};
use log::info;
use tera::Tera;

use crate::types::ABError;

pub struct Mail<'a> {
    pub smtp_transport: &'a SmtpTransport,
    pub tera: &'a Tera,
    pub context: tera::Context,
    pub to: String,
    pub subject: String,
    pub text_body_template: String,
    pub html_body_template: Option<String>,
}

impl<'a> Mail<'a> {
    pub fn new(
        smtp_transport: &'a SmtpTransport,
        tera: &'a Tera,
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

    pub fn send(&self) -> Result<(), ABError> {
        let text_body = self
            .tera
            .render(&self.text_body_template, &self.context)
            .map_err(|e| {
                ABError::InternalServerError(format!("Template rendering error: {}", e))
            })?;

        let email_builder = Message::builder()
            .from(Mailbox::new(
                Some("Airborne No Reply".to_owned()),
                "no-reply@airborne.io".parse().unwrap(),
            ))
            .to(Mailbox::new(
                Some("".to_string()),
                self.to.parse::<Address>().map_err(|e| {
                    ABError::InternalServerError(format!("Invalid email address: {}", e))
                })?,
            ))
            .subject(self.subject.clone());

        let email = match &self.html_body_template {
            Some(html_body_template) => {
                let html_body = self
                    .tera
                    .render(html_body_template, &self.context)
                    .map_err(|e| {
                        ABError::InternalServerError(format!("Template rendering error: {}", e))
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

        let mailer = self.smtp_transport;
        match mailer.send(&email) {
            Ok(_) => {
                info!("Email sent successfully!");
                Ok(())
            }
            Err(e) => {
                info!("Could not send email: {:?}", e);
                Err(ABError::InternalServerError(format!(
                    "Email sending error: {}",
                    e
                )))
            }
        }
    }
}
