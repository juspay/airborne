// smithy-typescript generated code
import {
  CreateApplicationCommandInput,
  CreateApplicationCommandOutput,
} from "../commands/CreateApplicationCommand";
import {
  CreateControlCenterGroupCommandInput,
  CreateControlCenterGroupCommandOutput,
} from "../commands/CreateControlCenterGroupCommand";
import {
  CreateDimensionCommandInput,
  CreateDimensionCommandOutput,
} from "../commands/CreateDimensionCommand";
import {
  CreateFileCommandInput,
  CreateFileCommandOutput,
} from "../commands/CreateFileCommand";
import {
  CreateOrganisationCommandInput,
  CreateOrganisationCommandOutput,
} from "../commands/CreateOrganisationCommand";
import {
  CreatePackageCommandInput,
  CreatePackageCommandOutput,
} from "../commands/CreatePackageCommand";
import {
  CreateReleaseCommandInput,
  CreateReleaseCommandOutput,
} from "../commands/CreateReleaseCommand";
import {
  DeleteControlCenterGroupCommandInput,
  DeleteControlCenterGroupCommandOutput,
} from "../commands/DeleteControlCenterGroupCommand";
import {
  DeleteDimensionCommandInput,
  DeleteDimensionCommandOutput,
} from "../commands/DeleteDimensionCommand";
import {
  GetControlCenterOverviewCommandInput,
  GetControlCenterOverviewCommandOutput,
} from "../commands/GetControlCenterOverviewCommand";
import {
  GetControlCenterReleaseEventsCommandInput,
  GetControlCenterReleaseEventsCommandOutput,
} from "../commands/GetControlCenterReleaseEventsCommand";
import {
  GetControlCenterRollbackPreviewCommandInput,
  GetControlCenterRollbackPreviewCommandOutput,
} from "../commands/GetControlCenterRollbackPreviewCommand";
import {
  GetReleaseCommandInput,
  GetReleaseCommandOutput,
} from "../commands/GetReleaseCommand";
import {
  GetUserCommandInput,
  GetUserCommandOutput,
} from "../commands/GetUserCommand";
import {
  ListControlCenterGroupsCommandInput,
  ListControlCenterGroupsCommandOutput,
} from "../commands/ListControlCenterGroupsCommand";
import {
  ListControlCenterOperationsCommandInput,
  ListControlCenterOperationsCommandOutput,
} from "../commands/ListControlCenterOperationsCommand";
import {
  ListDimensionsCommandInput,
  ListDimensionsCommandOutput,
} from "../commands/ListDimensionsCommand";
import {
  ListFileGroupsCommandInput,
  ListFileGroupsCommandOutput,
} from "../commands/ListFileGroupsCommand";
import {
  ListFilesCommandInput,
  ListFilesCommandOutput,
} from "../commands/ListFilesCommand";
import {
  ListOrganisationsCommandInput,
  ListOrganisationsCommandOutput,
} from "../commands/ListOrganisationsCommand";
import {
  ListPackagesCommandInput,
  ListPackagesCommandOutput,
} from "../commands/ListPackagesCommand";
import {
  ListReleasesCommandInput,
  ListReleasesCommandOutput,
} from "../commands/ListReleasesCommand";
import {
  PostLoginCommandInput,
  PostLoginCommandOutput,
} from "../commands/PostLoginCommand";
import {
  RequestOrganisationCommandInput,
  RequestOrganisationCommandOutput,
} from "../commands/RequestOrganisationCommand";
import {
  ResolveControlCenterOperationCommandInput,
  ResolveControlCenterOperationCommandOutput,
} from "../commands/ResolveControlCenterOperationCommand";
import {
  RollbackReleaseCommandInput,
  RollbackReleaseCommandOutput,
} from "../commands/RollbackReleaseCommand";
import {
  ServeReleaseCommandInput,
  ServeReleaseCommandOutput,
} from "../commands/ServeReleaseCommand";
import {
  ServeReleaseV2CommandInput,
  ServeReleaseV2CommandOutput,
} from "../commands/ServeReleaseV2Command";
import {
  UpdateControlCenterGroupCommandInput,
  UpdateControlCenterGroupCommandOutput,
} from "../commands/UpdateControlCenterGroupCommand";
import {
  UpdateDimensionCommandInput,
  UpdateDimensionCommandOutput,
} from "../commands/UpdateDimensionCommand";
import {
  UpdateFileCommandInput,
  UpdateFileCommandOutput,
} from "../commands/UpdateFileCommand";
import {
  UploadFileCommandInput,
  UploadFileCommandOutput,
} from "../commands/UploadFileCommand";
import { AirborneServiceException as __BaseException } from "../models/AirborneServiceException";
import {
  BadRequestError,
  ConfigProperties,
  ConflictError,
  ControlCenterActiveRelease,
  ControlCenterAppStatus,
  ControlCenterGroupMember,
  ControlCenterLiveRelease,
  ControlCenterOrganisationOverview,
  ControlCenterOverviewGroup,
  ControlCenterReleaseEvent,
  ControlCenterUnresolvedOperation,
  ControlCenterUnresolvedOperationDetails,
  CreateFileResponse,
  CreateReleaseRequestConfig,
  CreateReleaseRequestPackage,
  DimensionResponse,
  ForbiddenError,
  GetReleaseConfig,
  GetReleaseResponse,
  InternalServerError,
  NotFoundError,
  ReleaseSupersededError,
  RollbackPartialFailureError,
  RollbackReplacementChangedError,
  RollbackUnprocessableError,
  ServePackage,
  Unauthorized,
  UnresolvedOperationError,
} from "../models/models_0";
import {
  loadRestJsonErrorCode,
  parseJsonBody as parseBody,
  parseJsonErrorBody as parseErrorBody,
} from "@aws-sdk/core";
import { requestBuilder as rb } from "@smithy/core";
import {
  HttpRequest as __HttpRequest,
  HttpResponse as __HttpResponse,
} from "@smithy/protocol-http";
import {
  decorateServiceException as __decorateServiceException,
  expectBoolean as __expectBoolean,
  expectInt32 as __expectInt32,
  expectLong as __expectLong,
  expectNonNull as __expectNonNull,
  expectObject as __expectObject,
  expectString as __expectString,
  extendedEncodeURIComponent as __extendedEncodeURIComponent,
  parseRfc3339DateTimeWithOffset as __parseRfc3339DateTimeWithOffset,
  resolvedPath as __resolvedPath,
  _json,
  collectBody,
  isSerializableHeaderValue,
  map,
  take,
  withBaseException,
} from "@smithy/smithy-client";
import {
  DocumentType as __DocumentType,
  Endpoint as __Endpoint,
  ResponseMetadata as __ResponseMetadata,
  SerdeContext as __SerdeContext,
} from "@smithy/types";

/**
 * serializeAws_restJson1CreateApplicationCommand
 */
export const se_CreateApplicationCommand = async(
  input: CreateApplicationCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
  });
  b.bp("/api/organisations/applications/create");
  let body: any;
  body = JSON.stringify(take(input, {
    'application': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreateControlCenterGroupCommand
 */
export const se_CreateControlCenterGroupCommand = async(
  input: CreateControlCenterGroupCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
  });
  b.bp("/api/control-center/groups");
  let body: any;
  body = JSON.stringify(take(input, {
    'members': _ => _json(_),
    'name': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreateDimensionCommand
 */
export const se_CreateDimensionCommand = async(
  input: CreateDimensionCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/organisations/applications/dimension/create");
  let body: any;
  body = JSON.stringify(take(input, {
    'depends_on': [],
    'description': [],
    'dimension': [],
    'dimension_type': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreateFileCommand
 */
export const se_CreateFileCommand = async(
  input: CreateFileCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/file");
  let body: any;
  body = JSON.stringify(take(input, {
    'file_path': [],
    'metadata': _ => se_Document(_, context),
    'tag': [],
    'url': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreateOrganisationCommand
 */
export const se_CreateOrganisationCommand = async(
  input: CreateOrganisationCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
    'content-type': 'application/json',
  };
  b.bp("/api/organisations/create");
  let body: any;
  body = JSON.stringify(take(input, {
    'name': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreatePackageCommand
 */
export const se_CreatePackageCommand = async(
  input: CreatePackageCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/packages");
  let body: any;
  body = JSON.stringify(take(input, {
    'files': _ => _json(_),
    'index': [],
    'tag': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1CreateReleaseCommand
 */
export const se_CreateReleaseCommand = async(
  input: CreateReleaseCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/releases");
  let body: any;
  body = JSON.stringify(take(input, {
    'config': _ => se_CreateReleaseRequestConfig(_, context),
    'dimensions': _ => se_DimensionsMap(_, context),
    'package': _ => se_CreateReleaseRequestPackage(_, context),
    'package_id': [],
    'resources': _ => _json(_),
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1DeleteControlCenterGroupCommand
 */
export const se_DeleteControlCenterGroupCommand = async(
  input: DeleteControlCenterGroupCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
  });
  b.bp("/api/control-center/groups/{id}");
  b.p('id', () => input.id!, '{id}', false)
  let body: any;
  b.m("DELETE")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1DeleteDimensionCommand
 */
export const se_DeleteDimensionCommand = async(
  input: DeleteDimensionCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/organisations/applications/dimension/{dimension}");
  b.p('dimension', () => input.dimension!, '{dimension}', false)
  let body: any;
  b.m("DELETE")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1GetControlCenterOverviewCommand
 */
export const se_GetControlCenterOverviewCommand = async(
  input: GetControlCenterOverviewCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
  };
  b.bp("/api/control-center/overview");
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1GetControlCenterReleaseEventsCommand
 */
export const se_GetControlCenterReleaseEventsCommand = async(
  input: GetControlCenterReleaseEventsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/control-center/releases/{release_id}/events");
  b.p('release_id', () => input.release_id!, '{release_id}', false)
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1GetControlCenterRollbackPreviewCommand
 */
export const se_GetControlCenterRollbackPreviewCommand = async(
  input: GetControlCenterRollbackPreviewCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/control-center/releases/{release_id}/rollback-preview");
  b.p('release_id', () => input.release_id!, '{release_id}', false)
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1GetReleaseCommand
 */
export const se_GetReleaseCommand = async(
  input: GetReleaseCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/releases/{releaseId}");
  b.p('releaseId', () => input.releaseId!, '{releaseId}', false)
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1GetUserCommand
 */
export const se_GetUserCommand = async(
  input: GetUserCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
  };
  b.bp("/api/users");
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListControlCenterGroupsCommand
 */
export const se_ListControlCenterGroupsCommand = async(
  input: ListControlCenterGroupsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
  });
  b.bp("/api/control-center/groups");
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListControlCenterOperationsCommand
 */
export const se_ListControlCenterOperationsCommand = async(
  input: ListControlCenterOperationsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/control-center/operations");
  const query: any = map({
    [_s]: [,input[_s]!],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListDimensionsCommand
 */
export const se_ListDimensionsCommand = async(
  input: ListDimensionsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/organisations/applications/dimension/list");
  const query: any = map({
    [_p]: [() => input.page !== void 0, () => (input[_p]!.toString())],
    [_c]: [() => input.count !== void 0, () => (input[_c]!.toString())],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListFileGroupsCommand
 */
export const se_ListFileGroupsCommand = async(
  input: ListFileGroupsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/file/groups");
  const query: any = map({
    [_p]: [() => input.page !== void 0, () => (input[_p]!.toString())],
    [_c]: [() => input.count !== void 0, () => (input[_c]!.toString())],
    [_se]: [,input[_se]!],
    [_t]: [,input[_t]!],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListFilesCommand
 */
export const se_ListFilesCommand = async(
  input: ListFilesCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/file/list");
  const query: any = map({
    [_p]: [() => input.page !== void 0, () => (input[_p]!.toString())],
    [_pp]: [() => input.per_page !== void 0, () => (input[_pp]!.toString())],
    [_se]: [,input[_se]!],
    [_t]: [,input[_t]!],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListOrganisationsCommand
 */
export const se_ListOrganisationsCommand = async(
  input: ListOrganisationsCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
  };
  b.bp("/api/organisations");
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListPackagesCommand
 */
export const se_ListPackagesCommand = async(
  input: ListPackagesCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/packages/list");
  const query: any = map({
    [_p]: [() => input.page !== void 0, () => (input[_p]!.toString())],
    [_c]: [() => input.count !== void 0, () => (input[_c]!.toString())],
    [_se]: [,input[_se]!],
    [_al]: [() => input.all !== void 0, () => (input[_al]!.toString())],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ListReleasesCommand
 */
export const se_ListReleasesCommand = async(
  input: ListReleasesCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    [_xd]: input[_d]!,
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/releases/list");
  const query: any = map({
    [_p]: [() => input.page !== void 0, () => (input[_p]!.toString())],
    [_c]: [() => input.count !== void 0, () => (input[_c]!.toString())],
    [_al]: [() => input.all !== void 0, () => (input[_al]!.toString())],
    [_s]: [,input[_s]!],
  });
  let body: any;
  b.m("GET")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1PostLoginCommand
 */
export const se_PostLoginCommand = async(
  input: PostLoginCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
    'content-type': 'application/json',
  };
  b.bp("/api/token/issue");
  let body: any;
  body = JSON.stringify(take(input, {
    'client_id': [],
    'client_secret': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1RequestOrganisationCommand
 */
export const se_RequestOrganisationCommand = async(
  input: RequestOrganisationCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
    'content-type': 'application/json',
  };
  b.bp("/api/organisations/request");
  let body: any;
  body = JSON.stringify(take(input, {
    'app_store_link': [],
    'email': [],
    'name': [],
    'organisation_name': [],
    'phone': [],
    'play_store_link': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ResolveControlCenterOperationCommand
 */
export const se_ResolveControlCenterOperationCommand = async(
  input: ResolveControlCenterOperationCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/control-center/operations/{id}/resolve");
  b.p('id', () => input.id!, '{id}', false)
  let body: any;
  body = JSON.stringify(take(input, {
    'finding': [],
    'reason': [],
    'request_terminated': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1RollbackReleaseCommand
 */
export const se_RollbackReleaseCommand = async(
  input: RollbackReleaseCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/releases/{release_id}/rollback");
  b.p('release_id', () => input.release_id!, '{release_id}', false)
  let body: any;
  body = JSON.stringify(take(input, {
    'reason': [],
  }));
  b.m("POST")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ServeReleaseCommand
 */
export const se_ServeReleaseCommand = async(
  input: ServeReleaseCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
  };
  b.bp("/release/{organisation}/{application}");
  b.p('organisation', () => input.organisation!, '{organisation}', false)
  b.p('application', () => input.application!, '{application}', false)
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1ServeReleaseV2Command
 */
export const se_ServeReleaseV2Command = async(
  input: ServeReleaseV2CommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = {
  };
  b.bp("/release/v2/{organisation}/{application}");
  b.p('organisation', () => input.organisation!, '{organisation}', false)
  b.p('application', () => input.application!, '{application}', false)
  let body: any;
  b.m("GET")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1UpdateControlCenterGroupCommand
 */
export const se_UpdateControlCenterGroupCommand = async(
  input: UpdateControlCenterGroupCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
  });
  b.bp("/api/control-center/groups/{id}");
  b.p('id', () => input.id!, '{id}', false)
  let body: any;
  body = JSON.stringify(take(input, {
    'members': _ => _json(_),
    'name': [],
  }));
  b.m("PUT")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1UpdateDimensionCommand
 */
export const se_UpdateDimensionCommand = async(
  input: UpdateDimensionCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/organisations/applications/dimension/{dimension}");
  b.p('dimension', () => input.dimension!, '{dimension}', false)
  let body: any;
  body = JSON.stringify(take(input, {
    'change_reason': [],
    'position': [],
  }));
  b.m("PUT")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1UpdateFileCommand
 */
export const se_UpdateFileCommand = async(
  input: UpdateFileCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/file/{file_key}");
  b.p('file_key', () => input.file_key!, '{file_key}', false)
  let body: any;
  body = JSON.stringify(take(input, {
    'tag': [],
  }));
  b.m("PATCH")
  .h(headers)
  .b(body);
  return b.build();
}

/**
 * serializeAws_restJson1UploadFileCommand
 */
export const se_UploadFileCommand = async(
  input: UploadFileCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const b = rb(input, context);
  const headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/octet-stream',
    [_xc]: input[_ch]!,
    [_xo]: input[_o]!,
    [_xa]: input[_a]!,
  });
  b.bp("/api/file/upload");
  const query: any = map({
    [_fp]: [,__expectNonNull(input[_fp]!, `file_path`)],
    [_ta]: [,input[_ta]!],
  });
  let body: any;
  if (input.file !== undefined) {
    body = input.file;
  }
  b.m("POST")
  .h(headers)
  .q(query)
  .b(body);
  return b.build();
}

/**
 * deserializeAws_restJson1CreateApplicationCommand
 */
export const de_CreateApplicationCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateApplicationCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'access': _json,
    'application': __expectString,
    'organisation': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreateControlCenterGroupCommand
 */
export const de_CreateControlCenterGroupCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateControlCenterGroupCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'id': __expectString,
    'members': _json,
    'name': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreateDimensionCommand
 */
export const de_CreateDimensionCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateDimensionCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'change_reason': __expectString,
    'description': _ => de_Document(_, context),
    'dimension': __expectString,
    'position': __expectInt32,
    'schema': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreateFileCommand
 */
export const de_CreateFileCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateFileCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'checksum': __expectString,
    'created_at': __expectString,
    'file_path': __expectString,
    'id': __expectString,
    'metadata': _ => de_Document(_, context),
    'size': __expectInt32,
    'status': __expectString,
    'tag': __expectString,
    'url': __expectString,
    'version': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreateOrganisationCommand
 */
export const de_CreateOrganisationCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateOrganisationCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'access': _json,
    'applications': _json,
    'name': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreatePackageCommand
 */
export const de_CreatePackageCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreatePackageCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'files': _json,
    'index': __expectString,
    'tag': __expectString,
    'version': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1CreateReleaseCommand
 */
export const de_CreateReleaseCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CreateReleaseCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'config': _ => de_GetReleaseConfig(_, context),
    'created_at': __expectString,
    'dimensions': _ => de_DimensionsMap(_, context),
    'experiment': _json,
    'id': __expectString,
    'package': _ => de_ServePackage(_, context),
    'warnings': _json,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1DeleteControlCenterGroupCommand
 */
export const de_DeleteControlCenterGroupCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<DeleteControlCenterGroupCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'success': __expectBoolean,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1DeleteDimensionCommand
 */
export const de_DeleteDimensionCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<DeleteDimensionCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  await collectBody(output.body, context);
  return contents;
}

/**
 * deserializeAws_restJson1GetControlCenterOverviewCommand
 */
export const de_GetControlCenterOverviewCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetControlCenterOverviewCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'generated_at': _ => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
    'organisations': _ => de_ControlCenterOrganisationOverviewList(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1GetControlCenterReleaseEventsCommand
 */
export const de_GetControlCenterReleaseEventsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetControlCenterReleaseEventsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'events': _ => de_ControlCenterReleaseEventList(_, context),
    'outcome': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1GetControlCenterRollbackPreviewCommand
 */
export const de_GetControlCenterRollbackPreviewCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetControlCenterRollbackPreviewCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'action': _ => de_Document(_, context),
    'blocked': _ => de_Document(_, context),
    'current_package_version': _ => de_Document(_, context),
    'reconciled_keys': _ => de_Document(_, context),
    'resulting_package_version': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1GetReleaseCommand
 */
export const de_GetReleaseCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetReleaseCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'config': _ => de_GetReleaseConfig(_, context),
    'created_at': __expectString,
    'dimensions': _ => de_DimensionsMap(_, context),
    'experiment': _json,
    'id': __expectString,
    'package': _ => de_ServePackage(_, context),
    'resources': _json,
    'warnings': _json,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1GetUserCommand
 */
export const de_GetUserCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetUserCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'organisations': _json,
    'user_id': __expectString,
    'user_token': _json,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListControlCenterGroupsCommand
 */
export const de_ListControlCenterGroupsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListControlCenterGroupsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'groups': _json,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListControlCenterOperationsCommand
 */
export const de_ListControlCenterOperationsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListControlCenterOperationsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'operations': _ => de_ControlCenterUnresolvedOperationDetailsList(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListDimensionsCommand
 */
export const de_ListDimensionsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListDimensionsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'data': _ => de_DimensionList(_, context),
    'total_items': __expectInt32,
    'total_pages': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListFileGroupsCommand
 */
export const de_ListFileGroupsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListFileGroupsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'count': __expectInt32,
    'groups': _json,
    'page': __expectInt32,
    'total_items': __expectInt32,
    'total_pages': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListFilesCommand
 */
export const de_ListFilesCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListFilesCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'application': __expectString,
    'files': _ => de_FileResponseList(_, context),
    'organisation': __expectString,
    'page': __expectInt32,
    'per_page': __expectInt32,
    'total': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListOrganisationsCommand
 */
export const de_ListOrganisationsCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListOrganisationsCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'organisations': _json,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListPackagesCommand
 */
export const de_ListPackagesCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListPackagesCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'data': _json,
    'total_items': __expectInt32,
    'total_pages': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ListReleasesCommand
 */
export const de_ListReleasesCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ListReleasesCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'data': _ => de_GetReleaseResponseList(_, context),
    'total_items': __expectInt32,
    'total_pages': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1PostLoginCommand
 */
export const de_PostLoginCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<PostLoginCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'access_token': __expectString,
    'expires_in': __expectLong,
    'refresh_expires_in': __expectLong,
    'refresh_token': __expectString,
    'token_type': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1RequestOrganisationCommand
 */
export const de_RequestOrganisationCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<RequestOrganisationCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'message': __expectString,
    'organisation_name': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ResolveControlCenterOperationCommand
 */
export const de_ResolveControlCenterOperationCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ResolveControlCenterOperationCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'finding': __expectString,
    'operation_id': __expectString,
    'state': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1RollbackReleaseCommand
 */
export const de_RollbackReleaseCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<RollbackReleaseCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'action': __expectString,
    'current_live_release_id': _ => de_Document(_, context),
    'later_release_id': _ => de_Document(_, context),
    'new_release_id': _ => de_Document(_, context),
    'reconciled_keys': _json,
    'release_id': __expectString,
    'rolled_back_to_package_version': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ServeReleaseCommand
 */
export const de_ServeReleaseCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ServeReleaseCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'config': _ => de_GetReleaseConfig(_, context),
    'package': _json,
    'resources': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1ServeReleaseV2Command
 */
export const de_ServeReleaseV2Command = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<ServeReleaseV2CommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'config': _ => de_GetReleaseConfig(_, context),
    'package': _json,
    'resources': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1UpdateControlCenterGroupCommand
 */
export const de_UpdateControlCenterGroupCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<UpdateControlCenterGroupCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'id': __expectString,
    'members': _json,
    'name': __expectString,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1UpdateDimensionCommand
 */
export const de_UpdateDimensionCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<UpdateDimensionCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'change_reason': __expectString,
    'description': _ => de_Document(_, context),
    'dimension': __expectString,
    'mandatory': __expectBoolean,
    'position': __expectInt32,
    'schema': _ => de_Document(_, context),
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1UpdateFileCommand
 */
export const de_UpdateFileCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<UpdateFileCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'checksum': __expectString,
    'created_at': __expectString,
    'file_path': __expectString,
    'id': __expectString,
    'metadata': _ => de_Document(_, context),
    'size': __expectInt32,
    'status': __expectString,
    'tag': __expectString,
    'url': __expectString,
    'version': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserializeAws_restJson1UploadFileCommand
 */
export const de_UploadFileCommand = async(
  output: __HttpResponse,
  context: __SerdeContext
): Promise<UploadFileCommandOutput> => {
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError(output, context);
  }
  const contents: any = map({
    $metadata: deserializeMetadata(output),
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'checksum': __expectString,
    'created_at': __expectString,
    'file_path': __expectString,
    'id': __expectString,
    'metadata': _ => de_Document(_, context),
    'size': __expectInt32,
    'status': __expectString,
    'tag': __expectString,
    'url': __expectString,
    'version': __expectInt32,
  });
  Object.assign(contents, doc);
  return contents;
}

/**
 * deserialize_Aws_restJson1CommandError
 */
const de_CommandError = async(
  output: __HttpResponse,
  context: __SerdeContext,
): Promise<never> => {
  const parsedOutput: any = {
    ...output,
    body: await parseErrorBody(output.body, context)
  };
  const errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
  switch (errorCode) {
    case "BadRequestError":
    case "io.airborne.server#BadRequestError":
      throw await de_BadRequestErrorRes(parsedOutput, context);
    case "ForbiddenError":
    case "io.airborne.server#ForbiddenError":
      throw await de_ForbiddenErrorRes(parsedOutput, context);
    case "InternalServerError":
    case "io.airborne.server#InternalServerError":
      throw await de_InternalServerErrorRes(parsedOutput, context);
    case "NotFoundError":
    case "io.airborne.server#NotFoundError":
      throw await de_NotFoundErrorRes(parsedOutput, context);
    case "Unauthorized":
    case "io.airborne.server#Unauthorized":
      throw await de_UnauthorizedRes(parsedOutput, context);
    case "ConflictError":
    case "io.airborne.server#ConflictError":
      throw await de_ConflictErrorRes(parsedOutput, context);
    case "UnresolvedOperationError":
    case "io.airborne.server#UnresolvedOperationError":
      throw await de_UnresolvedOperationErrorRes(parsedOutput, context);
    case "ReleaseSupersededError":
    case "io.airborne.server#ReleaseSupersededError":
      throw await de_ReleaseSupersededErrorRes(parsedOutput, context);
    case "RollbackPartialFailureError":
    case "io.airborne.server#RollbackPartialFailureError":
      throw await de_RollbackPartialFailureErrorRes(parsedOutput, context);
    case "RollbackReplacementChangedError":
    case "io.airborne.server#RollbackReplacementChangedError":
      throw await de_RollbackReplacementChangedErrorRes(parsedOutput, context);
    case "RollbackUnprocessableError":
    case "io.airborne.server#RollbackUnprocessableError":
      throw await de_RollbackUnprocessableErrorRes(parsedOutput, context);
    default:
      const parsedBody = parsedOutput.body;
      return throwDefaultError({
        output,
        parsedBody,
        errorCode
      }) as never
    }
  }

  const throwDefaultError = withBaseException(__BaseException);
  /**
   * deserializeAws_restJson1BadRequestErrorRes
   */
  const de_BadRequestErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<BadRequestError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new BadRequestError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1ConflictErrorRes
   */
  const de_ConflictErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<ConflictError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ConflictError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1ForbiddenErrorRes
   */
  const de_ForbiddenErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<ForbiddenError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ForbiddenError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1InternalServerErrorRes
   */
  const de_InternalServerErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<InternalServerError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new InternalServerError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1NotFoundErrorRes
   */
  const de_NotFoundErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<NotFoundError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new NotFoundError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1ReleaseSupersededErrorRes
   */
  const de_ReleaseSupersededErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<ReleaseSupersededError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'current_live_release_id': _ => de_Document(_, context),
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ReleaseSupersededError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1RollbackPartialFailureErrorRes
   */
  const de_RollbackPartialFailureErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<RollbackPartialFailureError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
      'replacement_release_id': _ => de_Document(_, context),
      'rollback_operation_id': __expectString,
      'stage': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new RollbackPartialFailureError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1RollbackReplacementChangedErrorRes
   */
  const de_RollbackReplacementChangedErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<RollbackReplacementChangedError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
      'operation_id': __expectString,
      'replacement_release_id': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new RollbackReplacementChangedError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1RollbackUnprocessableErrorRes
   */
  const de_RollbackUnprocessableErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<RollbackUnprocessableError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'current_live_release_id': _ => de_Document(_, context),
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new RollbackUnprocessableError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1UnauthorizedRes
   */
  const de_UnauthorizedRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<Unauthorized> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'code': __expectString,
      'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new Unauthorized({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  /**
   * deserializeAws_restJson1UnresolvedOperationErrorRes
   */
  const de_UnresolvedOperationErrorRes = async (
    parsedOutput: any,
    context: __SerdeContext
  ): Promise<UnresolvedOperationError> => {
    const contents: any = map({
    });
    const data: any = parsedOutput.body;
    const doc = take(data, {
      'before': _ => de_Document(_, context),
      'code': __expectString,
      'expected': _ => de_Document(_, context),
      'message': __expectString,
      'operation_id': __expectString,
      'own_attempt': __expectBoolean,
      'upstream_org': _ => de_Document(_, context),
      'upstream_workspace': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    const exception = new UnresolvedOperationError({
      $metadata: deserializeMetadata(parsedOutput),
      ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
  };

  // se_ControlCenterGroupMember omitted.

  // se_ControlCenterGroupMemberList omitted.

  /**
   * serializeAws_restJson1CreateReleaseRequestConfig
   */
  const se_CreateReleaseRequestConfig = (
    input: CreateReleaseRequestConfig,
    context: __SerdeContext
  ): any => {
    return take(input, {
      'boot_timeout': [],
      'properties': _ => se_Document(_, context),
      'release_config_timeout': [],
    });
  }

  /**
   * serializeAws_restJson1CreateReleaseRequestPackage
   */
  const se_CreateReleaseRequestPackage = (
    input: CreateReleaseRequestPackage,
    context: __SerdeContext
  ): any => {
    return take(input, {
      'important': _json,
      'lazy': _json,
      'properties': _ => se_Document(_, context),
    });
  }

  /**
   * serializeAws_restJson1DimensionsMap
   */
  const se_DimensionsMap = (
    input: Record<string, __DocumentType>,
    context: __SerdeContext
  ): any => {
    return Object.entries(input).reduce((acc: Record<string, any>, [key, value]: [string, any]) => {
      if (value === null) {
        return acc;
      }
      acc[key] = se_Document(value, context);
      return acc;
    }, {});
  }

  // se_StringList omitted.

  /**
   * serializeAws_restJson1Document
   */
  const se_Document = (
    input: __DocumentType,
    context: __SerdeContext
  ): any => {
    return input;
  }

  // de_Application omitted.

  // de_Applications omitted.

  /**
   * deserializeAws_restJson1ConfigProperties
   */
  const de_ConfigProperties = (
    output: any,
    context: __SerdeContext
  ): ConfigProperties => {
    return take(output, {
      'tenant_info': (_: any) => de_Document(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterActiveRelease
   */
  const de_ControlCenterActiveRelease = (
    output: any,
    context: __SerdeContext
  ): ControlCenterActiveRelease => {
    return take(output, {
      'created_at': (_: any) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
      'created_by': __expectString,
      'dimensions': (_: any) => de_Document(_, context),
      'experimental_variant': __expectString,
      'package_version': __expectLong,
      'release_id': __expectString,
      'status': __expectString,
      'traffic_percentage': __expectInt32,
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterActiveReleaseList
   */
  const de_ControlCenterActiveReleaseList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterActiveRelease)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterActiveRelease(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterAppStatus
   */
  const de_ControlCenterAppStatus = (
    output: any,
    context: __SerdeContext
  ): ControlCenterAppStatus => {
    return take(output, {
      'active': (_: any) => de_ControlCenterActiveReleaseList(_, context),
      'application': __expectString,
      'error': (_: any) => de_Document(_, context),
      'last_activity_at': (_: any) => de_Document(_, context),
      'live': (_: any) => de_ControlCenterLiveReleaseList(_, context),
      'platform': (_: any) => de_Document(_, context),
      'unresolved_operations': (_: any) => de_ControlCenterUnresolvedOperationList(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterAppStatusList
   */
  const de_ControlCenterAppStatusList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterAppStatus)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterAppStatus(entry, context);
    });
    return retVal;
  }

  // de_ControlCenterGroup omitted.

  // de_ControlCenterGroupList omitted.

  // de_ControlCenterGroupMember omitted.

  // de_ControlCenterGroupMemberList omitted.

  /**
   * deserializeAws_restJson1ControlCenterLiveRelease
   */
  const de_ControlCenterLiveRelease = (
    output: any,
    context: __SerdeContext
  ): ControlCenterLiveRelease => {
    return take(output, {
      'concluded_at': (_: any) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
      'config_version': __expectString,
      'dimensions': (_: any) => de_Document(_, context),
      'package_version': __expectLong,
      'release_id': __expectString,
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterLiveReleaseList
   */
  const de_ControlCenterLiveReleaseList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterLiveRelease)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterLiveRelease(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterOrganisationOverview
   */
  const de_ControlCenterOrganisationOverview = (
    output: any,
    context: __SerdeContext
  ): ControlCenterOrganisationOverview => {
    return take(output, {
      'groups': (_: any) => de_ControlCenterOverviewGroupList(_, context),
      'name': __expectString,
      'ungrouped': (_: any) => de_ControlCenterAppStatusList(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterOrganisationOverviewList
   */
  const de_ControlCenterOrganisationOverviewList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterOrganisationOverview)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterOrganisationOverview(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterOverviewGroup
   */
  const de_ControlCenterOverviewGroup = (
    output: any,
    context: __SerdeContext
  ): ControlCenterOverviewGroup => {
    return take(output, {
      'id': __expectString,
      'members': (_: any) => de_ControlCenterAppStatusList(_, context),
      'name': __expectString,
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterOverviewGroupList
   */
  const de_ControlCenterOverviewGroupList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterOverviewGroup)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterOverviewGroup(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterReleaseEvent
   */
  const de_ControlCenterReleaseEvent = (
    output: any,
    context: __SerdeContext
  ): ControlCenterReleaseEvent => {
    return take(output, {
      'action': __expectString,
      'actor': __expectString,
      'created_at': (_: any) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
      'payload': (_: any) => de_Document(_, context),
      'synthetic': __expectBoolean,
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterReleaseEventList
   */
  const de_ControlCenterReleaseEventList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterReleaseEvent)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterReleaseEvent(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterUnresolvedOperation
   */
  const de_ControlCenterUnresolvedOperation = (
    output: any,
    context: __SerdeContext
  ): ControlCenterUnresolvedOperation => {
    return take(output, {
      'before': (_: any) => de_Document(_, context),
      'expected': (_: any) => de_Document(_, context),
      'message': __expectString,
      'operation_id': __expectString,
      'upstream_workspace': (_: any) => de_Document(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterUnresolvedOperationDetails
   */
  const de_ControlCenterUnresolvedOperationDetails = (
    output: any,
    context: __SerdeContext
  ): ControlCenterUnresolvedOperationDetails => {
    return take(output, {
      'before': (_: any) => de_Document(_, context),
      'code': __expectString,
      'expected': (_: any) => de_Document(_, context),
      'message': __expectString,
      'operation_id': __expectString,
      'upstream_org': (_: any) => de_Document(_, context),
      'upstream_workspace': (_: any) => de_Document(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1ControlCenterUnresolvedOperationDetailsList
   */
  const de_ControlCenterUnresolvedOperationDetailsList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterUnresolvedOperationDetails)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterUnresolvedOperationDetails(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1ControlCenterUnresolvedOperationList
   */
  const de_ControlCenterUnresolvedOperationList = (
    output: any,
    context: __SerdeContext
  ): (ControlCenterUnresolvedOperation)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_ControlCenterUnresolvedOperation(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1CreateFileResponse
   */
  const de_CreateFileResponse = (
    output: any,
    context: __SerdeContext
  ): CreateFileResponse => {
    return take(output, {
      'checksum': __expectString,
      'created_at': __expectString,
      'file_path': __expectString,
      'id': __expectString,
      'metadata': (_: any) => de_Document(_, context),
      'size': __expectInt32,
      'status': __expectString,
      'tag': __expectString,
      'url': __expectString,
      'version': __expectInt32,
    }) as any;
  }

  /**
   * deserializeAws_restJson1DimensionList
   */
  const de_DimensionList = (
    output: any,
    context: __SerdeContext
  ): (DimensionResponse)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_DimensionResponse(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1DimensionResponse
   */
  const de_DimensionResponse = (
    output: any,
    context: __SerdeContext
  ): DimensionResponse => {
    return take(output, {
      'change_reason': __expectString,
      'description': (_: any) => de_Document(_, context),
      'dimension': __expectString,
      'mandatory': __expectBoolean,
      'position': __expectInt32,
      'schema': (_: any) => de_Document(_, context),
    }) as any;
  }

  /**
   * deserializeAws_restJson1DimensionsMap
   */
  const de_DimensionsMap = (
    output: any,
    context: __SerdeContext
  ): Record<string, __DocumentType> => {
    return Object.entries(output).reduce((acc: Record<string, __DocumentType>, [key, value]: [string, any]) => {
      if (value === null) {
        return acc;
      }
      acc[key as string] = de_Document(value, context);
      return acc;

    }, {} as Record<string, __DocumentType>);}

  // de_FileGroup omitted.

  // de_FileGroupList omitted.

  // de_FileGroupTag omitted.

  // de_FileGroupTagList omitted.

  // de_FileGroupVersion omitted.

  // de_FileGroupVersionList omitted.

  /**
   * deserializeAws_restJson1FileResponseList
   */
  const de_FileResponseList = (
    output: any,
    context: __SerdeContext
  ): (CreateFileResponse)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_CreateFileResponse(entry, context);
    });
    return retVal;
  }

  /**
   * deserializeAws_restJson1GetReleaseConfig
   */
  const de_GetReleaseConfig = (
    output: any,
    context: __SerdeContext
  ): GetReleaseConfig => {
    return take(output, {
      'boot_timeout': __expectInt32,
      'properties': (_: any) => de_ConfigProperties(_, context),
      'release_config_timeout': __expectInt32,
      'version': __expectString,
    }) as any;
  }

  /**
   * deserializeAws_restJson1GetReleaseResponse
   */
  const de_GetReleaseResponse = (
    output: any,
    context: __SerdeContext
  ): GetReleaseResponse => {
    return take(output, {
      'config': (_: any) => de_GetReleaseConfig(_, context),
      'created_at': __expectString,
      'dimensions': (_: any) => de_DimensionsMap(_, context),
      'experiment': _json,
      'id': __expectString,
      'package': (_: any) => de_ServePackage(_, context),
      'resources': _json,
      'warnings': _json,
    }) as any;
  }

  /**
   * deserializeAws_restJson1GetReleaseResponseList
   */
  const de_GetReleaseResponseList = (
    output: any,
    context: __SerdeContext
  ): (GetReleaseResponse)[] => {
    const retVal = (output || []).filter((e: any) => e != null).map((entry: any) => {
      return de_GetReleaseResponse(entry, context);
    });
    return retVal;
  }

  // de_Organisation omitted.

  // de_Organisations omitted.

  // de_Package omitted.

  // de_PackageList omitted.

  // de_ReconciledKeys omitted.

  // de_ReleaseExperiment omitted.

  // de_ReleaseWarnings omitted.

  // de_ServeFile omitted.

  // de_ServeFileList omitted.

  /**
   * deserializeAws_restJson1ServePackage
   */
  const de_ServePackage = (
    output: any,
    context: __SerdeContext
  ): ServePackage => {
    return take(output, {
      'important': _json,
      'index': _json,
      'lazy': _json,
      'name': __expectString,
      'properties': (_: any) => de_Document(_, context),
      'version': __expectString,
    }) as any;
  }

  // de_StringList omitted.

  // de_UserToken omitted.

  /**
   * deserializeAws_restJson1Document
   */
  const de_Document = (
    output: any,
    context: __SerdeContext
  ): __DocumentType => {
    return output;
  }

  const deserializeMetadata = (output: __HttpResponse): __ResponseMetadata => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
  });

  // Encode Uint8Array data into string with utf-8.
  const collectBodyString = (streamBody: any, context: __SerdeContext): Promise<string> => collectBody(streamBody, context).then(body => context.utf8Encoder(body))

  const _a = "application";
  const _al = "all";
  const _c = "count";
  const _ch = "checksum";
  const _d = "dimension";
  const _fp = "file_path";
  const _o = "organisation";
  const _p = "page";
  const _pp = "per_page";
  const _s = "status";
  const _se = "search";
  const _t = "tags";
  const _ta = "tag";
  const _xa = "x-application";
  const _xc = "x-checksum";
  const _xd = "x-dimension";
  const _xo = "x-organisation";
