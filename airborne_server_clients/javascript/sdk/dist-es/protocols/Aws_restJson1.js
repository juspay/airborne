import { AirborneServiceException as __BaseException } from "../models/AirborneServiceException";
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError, Unauthorized, } from "../models/models_0";
import { loadRestJsonErrorCode, parseJsonBody as parseBody, parseJsonErrorBody as parseErrorBody, } from "@aws-sdk/core";
import { requestBuilder as rb } from "@smithy/core";
import { decorateServiceException as __decorateServiceException, expectBoolean as __expectBoolean, expectInt32 as __expectInt32, expectNonNull as __expectNonNull, expectObject as __expectObject, expectString as __expectString, _json, collectBody, isSerializableHeaderValue, map, take, withBaseException, } from "@smithy/smithy-client";
export const se_CreateApplicationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/organisations/applications/create");
    let body;
    body = JSON.stringify(take(input, {
        'application': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/create");
    let body;
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
};
export const se_CreateFileCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file");
    let body;
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
};
export const se_CreateOrganisationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/create");
    let body;
    body = JSON.stringify(take(input, {
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreatePackageCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages");
    let body;
    body = JSON.stringify(take(input, {
        'files': _ => _json(_),
        'index': [],
        'tag': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases");
    let body;
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
};
export const se_DeleteDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    b.m("DELETE")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{releaseId}");
    b.p('releaseId', () => input.releaseId, '{releaseId}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetUserCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/api/users");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ListDimensionsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListFilesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_pp]: [() => input.per_page !== void 0, () => (input[_pp].toString())],
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListOrganisationsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/api/organisations");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ListPackagesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
        [_s]: [, input[_s]],
        [_al]: [() => input.all !== void 0, () => (input[_al].toString())],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListReleasesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xd]: input[_d],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
        [_al]: [() => input.all !== void 0, () => (input[_al].toString())],
        [_st]: [, input[_st]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_PostLoginCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/token/issue");
    let body;
    body = JSON.stringify(take(input, {
        'client_id': [],
        'client_secret': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_RequestOrganisationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/request");
    let body;
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
};
export const se_ServeReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/release/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ServeReleaseV2Command = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/release/v2/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UpdateDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify(take(input, {
        'change_reason': [],
        'position': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UploadFileCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/octet-stream',
        [_xc]: input[_ch],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/upload");
    const query = map({
        [_fp]: [, __expectNonNull(input[_fp], `file_path`)],
        [_t]: [, input[_t]],
    });
    let body;
    if (input.file !== undefined) {
        body = input.file;
    }
    b.m("POST")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const de_CreateApplicationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'access': _json,
        'application': __expectString,
        'organisation': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'change_reason': __expectString,
        'description': _ => de_Document(_, context),
        'dimension': __expectString,
        'position': __expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
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
};
export const de_CreateOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'access': _json,
        'applications': _json,
        'name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreatePackageCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'files': _json,
        'index': __expectString,
        'tag': __expectString,
        'version': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': _ => de_ServePackage(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_DeleteDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_GetReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': _ => de_ServePackage(_, context),
        'resources': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetUserCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'organisations': _json,
        'user_id': __expectString,
        'user_token': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListDimensionsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _ => de_DimensionList(_, context),
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListFilesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
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
};
export const de_ListOrganisationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'organisations': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListPackagesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _json,
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListReleasesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _ => de_GetReleaseResponseList(_, context),
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_PostLoginCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'organisations': _json,
        'user_id': __expectString,
        'user_token': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_RequestOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'message': __expectString,
        'organisation_name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ServeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'package': _json,
        'resources': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ServeReleaseV2Command = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'package': _json,
        'resources': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UpdateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
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
};
export const de_UploadFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
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
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
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
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode
            });
    }
};
const throwDefaultError = withBaseException(__BaseException);
const de_BadRequestErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new BadRequestError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ForbiddenErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ForbiddenError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_NotFoundErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new NotFoundError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_UnauthorizedRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new Unauthorized({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const se_CreateReleaseRequestConfig = (input, context) => {
    return take(input, {
        'boot_timeout': [],
        'properties': _ => se_Document(_, context),
        'release_config_timeout': [],
    });
};
const se_CreateReleaseRequestPackage = (input, context) => {
    return take(input, {
        'important': _json,
        'lazy': _json,
        'properties': _ => se_Document(_, context),
    });
};
const se_DimensionsMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Document(value, context);
        return acc;
    }, {});
};
const se_Document = (input, context) => {
    return input;
};
const de_ConfigProperties = (output, context) => {
    return take(output, {
        'tenant_info': (_) => de_Document(_, context),
    });
};
const de_CreateFileResponse = (output, context) => {
    return take(output, {
        'checksum': __expectString,
        'created_at': __expectString,
        'file_path': __expectString,
        'id': __expectString,
        'metadata': (_) => de_Document(_, context),
        'size': __expectInt32,
        'status': __expectString,
        'tag': __expectString,
        'url': __expectString,
        'version': __expectInt32,
    });
};
const de_DimensionList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_DimensionResponse(entry, context);
    });
    return retVal;
};
const de_DimensionResponse = (output, context) => {
    return take(output, {
        'change_reason': __expectString,
        'description': (_) => de_Document(_, context),
        'dimension': __expectString,
        'mandatory': __expectBoolean,
        'position': __expectInt32,
        'schema': (_) => de_Document(_, context),
    });
};
const de_DimensionsMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_Document(value, context);
        return acc;
    }, {});
};
const de_FileResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_CreateFileResponse(entry, context);
    });
    return retVal;
};
const de_GetReleaseConfig = (output, context) => {
    return take(output, {
        'boot_timeout': __expectInt32,
        'properties': (_) => de_ConfigProperties(_, context),
        'release_config_timeout': __expectInt32,
        'version': __expectString,
    });
};
const de_GetReleaseResponse = (output, context) => {
    return take(output, {
        'config': (_) => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': (_) => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': (_) => de_ServePackage(_, context),
        'resources': _json,
    });
};
const de_GetReleaseResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_GetReleaseResponse(entry, context);
    });
    return retVal;
};
const de_ServePackage = (output, context) => {
    return take(output, {
        'important': _json,
        'index': _json,
        'lazy': _json,
        'name': __expectString,
        'properties': (_) => de_Document(_, context),
        'version': __expectString,
    });
};
const de_Document = (output, context) => {
    return output;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then(body => context.utf8Encoder(body));
const _a = "application";
const _al = "all";
const _c = "count";
const _ch = "checksum";
const _d = "dimension";
const _fp = "file_path";
const _o = "organisation";
const _p = "page";
const _pp = "per_page";
const _s = "search";
const _st = "status";
const _t = "tag";
const _xa = "x-application";
const _xc = "x-checksum";
const _xd = "x-dimension";
const _xo = "x-organisation";
