use proc_macro::TokenStream;
use quote::quote;
use syn::{
    parse::Parser, parse_macro_input, Attribute, Expr, ExprArray, ExprLit, ItemFn, Lit, LitBool,
    LitStr,
};

#[derive(Default)]
struct AuthzArgs {
    resource: Option<LitStr>,
    action: Option<LitStr>,
    allow_org: bool,
    allow_app: bool,
    webhook_allowed: bool,
    org_roles: Vec<LitStr>,
    app_roles: Vec<LitStr>,
}

impl AuthzArgs {
    fn parse_role_array(expr: ExprArray) -> Result<Vec<LitStr>, syn::Error> {
        let mut parsed = Vec::with_capacity(expr.elems.len());
        for entry in expr.elems {
            match entry {
                Expr::Lit(ExprLit {
                    lit: Lit::Str(role),
                    ..
                }) => parsed.push(role),
                _ => {
                    return Err(syn::Error::new_spanned(
                        entry,
                        "Role list entries must be string literals",
                    ))
                }
            }
        }
        Ok(parsed)
    }

    fn parse(input: TokenStream) -> Result<Self, syn::Error> {
        let mut args = AuthzArgs {
            allow_org: true,
            allow_app: true,
            webhook_allowed: true,
            ..Default::default()
        };

        let parser = syn::meta::parser(|meta| {
            if meta.path.is_ident("resource") {
                args.resource = Some(meta.value()?.parse()?);
                return Ok(());
            }
            if meta.path.is_ident("action") {
                args.action = Some(meta.value()?.parse()?);
                return Ok(());
            }
            if meta.path.is_ident("allow_org") {
                let value: LitBool = meta.value()?.parse()?;
                args.allow_org = value.value;
                return Ok(());
            }
            if meta.path.is_ident("allow_app") {
                let value: LitBool = meta.value()?.parse()?;
                args.allow_app = value.value;
                return Ok(());
            }
            if meta.path.is_ident("webhook_allowed") {
                let value: LitBool = meta.value()?.parse()?;
                args.webhook_allowed = value.value;
                return Ok(());
            }
            if meta.path.is_ident("org_roles") {
                // Supports: org_roles = ["owner", "admin"].
                let roles_expr: ExprArray = meta.value()?.parse()?;
                args.org_roles = Self::parse_role_array(roles_expr)?;
                return Ok(());
            }
            if meta.path.is_ident("app_roles") {
                // Supports: app_roles = ["admin", "write"].
                let roles_expr: ExprArray = meta.value()?.parse()?;
                args.app_roles = Self::parse_role_array(roles_expr)?;
                return Ok(());
            }

            Err(meta.error("Unsupported authz attribute argument"))
        });

        parser.parse(input)?;

        if args.resource.is_none() {
            return Err(syn::Error::new(
                proc_macro2::Span::call_site(),
                "Missing required argument: resource = \"...\"",
            ));
        }
        if args.action.is_none() {
            return Err(syn::Error::new(
                proc_macro2::Span::call_site(),
                "Missing required argument: action = \"...\"",
            ));
        }

        Ok(args)
    }
}

fn parse_method_and_path(attrs: &[Attribute]) -> (String, String) {
    for attr in attrs {
        let Some(ident) = attr.path().get_ident() else {
            continue;
        };
        let method = match ident.to_string().as_str() {
            "get" => Some("GET"),
            "post" => Some("POST"),
            "put" => Some("PUT"),
            "patch" => Some("PATCH"),
            "delete" => Some("DELETE"),
            _ => None,
        };
        let Some(method) = method else {
            continue;
        };

        let path = match attr.parse_args::<Expr>() {
            Ok(Expr::Lit(ExprLit {
                lit: Lit::Str(value),
                ..
            })) => value.value(),
            _ => String::new(),
        };

        return (method.to_string(), path);
    }

    ("UNKNOWN".to_string(), String::new())
}

#[proc_macro_attribute]
pub fn authz(args: TokenStream, item: TokenStream) -> TokenStream {
    let args = match AuthzArgs::parse(args) {
        Ok(parsed) => parsed,
        Err(error) => return error.to_compile_error().into(),
    };

    let mut function = parse_macro_input!(item as ItemFn);
    let original_block = function.block;

    let resource = args.resource.expect("validated above");
    let action = args.action.expect("validated above");
    let allow_org = args.allow_org;
    let allow_app = args.allow_app;
    let webhook_allowed = args.webhook_allowed;
    let org_roles = args.org_roles;
    let app_roles = args.app_roles;

    let (method, path) = parse_method_and_path(&function.attrs);
    let method_lit = LitStr::new(&method, proc_macro2::Span::call_site());
    let path_lit = LitStr::new(&path, proc_macro2::Span::call_site());

    function.block = Box::new(syn::parse_quote!({
        crate::provider::authz::permission::enforce_endpoint_permission(
            &state,
            &auth_response,
            #resource,
            #action,
            #allow_org,
            #allow_app,
        )
        .await?;
        #original_block
    }));

    TokenStream::from(quote! {
        ::inventory::submit! {
            crate::provider::authz::permission::EndpointPermissionBinding::new(
                #method_lit,
                #path_lit,
                #resource,
                #action,
                &[#(#org_roles),*],
                &[#(#app_roles),*],
                #allow_org,
                #allow_app,
                #webhook_allowed,
            )
        }

        #function
    })
}
