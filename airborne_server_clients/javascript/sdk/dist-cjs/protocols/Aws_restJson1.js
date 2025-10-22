"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.de_UploadFileCommand = exports.de_UpdateDimensionCommand = exports.de_ServeReleaseV2Command = exports.de_ServeReleaseCommand = exports.de_RequestOrganisationCommand = exports.de_PostLoginCommand = exports.de_ListReleasesCommand = exports.de_ListPackagesCommand = exports.de_ListOrganisationsCommand = exports.de_ListFilesCommand = exports.de_ListDimensionsCommand = exports.de_GetUserCommand = exports.de_GetReleaseCommand = exports.de_DeleteDimensionCommand = exports.de_CreateReleaseCommand = exports.de_CreatePackageCommand = exports.de_CreateOrganisationCommand = exports.de_CreateFileCommand = exports.de_CreateDimensionCommand = exports.de_CreateApplicationCommand = exports.se_UploadFileCommand = exports.se_UpdateDimensionCommand = exports.se_ServeReleaseV2Command = exports.se_ServeReleaseCommand = exports.se_RequestOrganisationCommand = exports.se_PostLoginCommand = exports.se_ListReleasesCommand = exports.se_ListPackagesCommand = exports.se_ListOrganisationsCommand = exports.se_ListFilesCommand = exports.se_ListDimensionsCommand = exports.se_GetUserCommand = exports.se_GetReleaseCommand = exports.se_DeleteDimensionCommand = exports.se_CreateReleaseCommand = exports.se_CreatePackageCommand = exports.se_CreateOrganisationCommand = exports.se_CreateFileCommand = exports.se_CreateDimensionCommand = exports.se_CreateApplicationCommand = void 0;
const AirborneServiceException_1 = require("../models/AirborneServiceException");
const models_0_1 = require("../models/models_0");
const core_1 = require("@aws-sdk/core");
const core_2 = require("@smithy/core");
const smithy_client_1 = require("@smithy/smithy-client");
const se_CreateApplicationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/organisations/applications/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'application': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateApplicationCommand = se_CreateApplicationCommand;
const se_CreateDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_CreateDimensionCommand = se_CreateDimensionCommand;
const se_CreateFileCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_CreateFileCommand = se_CreateFileCommand;
const se_CreateOrganisationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateOrganisationCommand = se_CreateOrganisationCommand;
const se_CreatePackageCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'files': _ => (0, smithy_client_1._json)(_),
        'index': [],
        'tag': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreatePackageCommand = se_CreatePackageCommand;
const se_CreateReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'config': _ => se_CreateReleaseRequestConfig(_, context),
        'dimensions': _ => se_DimensionsMap(_, context),
        'package': _ => se_CreateReleaseRequestPackage(_, context),
        'package_id': [],
        'resources': _ => (0, smithy_client_1._json)(_),
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateReleaseCommand = se_CreateReleaseCommand;
const se_DeleteDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_DeleteDimensionCommand = se_DeleteDimensionCommand;
const se_GetReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetReleaseCommand = se_GetReleaseCommand;
const se_GetUserCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/api/users");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_GetUserCommand = se_GetUserCommand;
const se_ListDimensionsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListDimensionsCommand = se_ListDimensionsCommand;
const se_ListFilesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListFilesCommand = se_ListFilesCommand;
const se_ListOrganisationsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/api/organisations");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ListOrganisationsCommand = se_ListOrganisationsCommand;
const se_ListPackagesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListPackagesCommand = se_ListPackagesCommand;
const se_ListReleasesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xd]: input[_d],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListReleasesCommand = se_ListReleasesCommand;
const se_PostLoginCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/token/issue");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'client_id': [],
        'client_secret': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_PostLoginCommand = se_PostLoginCommand;
const se_RequestOrganisationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/request");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_RequestOrganisationCommand = se_RequestOrganisationCommand;
const se_ServeReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
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
exports.se_ServeReleaseCommand = se_ServeReleaseCommand;
const se_ServeReleaseV2Command = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
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
exports.se_ServeReleaseV2Command = se_ServeReleaseV2Command;
const se_UpdateDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'change_reason': [],
        'position': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_UpdateDimensionCommand = se_UpdateDimensionCommand;
const se_UploadFileCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/octet-stream',
        [_xc]: input[_ch],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/upload");
    const query = (0, smithy_client_1.map)({
        [_fp]: [, (0, smithy_client_1.expectNonNull)(input[_fp], `file_path`)],
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
exports.se_UploadFileCommand = se_UploadFileCommand;
const de_CreateApplicationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'access': smithy_client_1._json,
        'application': smithy_client_1.expectString,
        'organisation': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateApplicationCommand = de_CreateApplicationCommand;
const de_CreateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'change_reason': smithy_client_1.expectString,
        'description': _ => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'position': smithy_client_1.expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateDimensionCommand = de_CreateDimensionCommand;
const de_CreateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': _ => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateFileCommand = de_CreateFileCommand;
const de_CreateOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'access': smithy_client_1._json,
        'applications': smithy_client_1._json,
        'name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateOrganisationCommand = de_CreateOrganisationCommand;
const de_CreatePackageCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'files': smithy_client_1._json,
        'index': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreatePackageCommand = de_CreatePackageCommand;
const de_CreateReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': _ => de_ServePackage(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateReleaseCommand = de_CreateReleaseCommand;
const de_DeleteDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    await (0, smithy_client_1.collectBody)(output.body, context);
    return contents;
};
exports.de_DeleteDimensionCommand = de_DeleteDimensionCommand;
const de_GetReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': _ => de_ServePackage(_, context),
        'resources': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetReleaseCommand = de_GetReleaseCommand;
const de_GetUserCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'organisations': smithy_client_1._json,
        'user_id': smithy_client_1.expectString,
        'user_token': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetUserCommand = de_GetUserCommand;
const de_ListDimensionsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': _ => de_DimensionList(_, context),
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListDimensionsCommand = de_ListDimensionsCommand;
const de_ListFilesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'application': smithy_client_1.expectString,
        'files': _ => de_FileResponseList(_, context),
        'organisation': smithy_client_1.expectString,
        'page': smithy_client_1.expectInt32,
        'per_page': smithy_client_1.expectInt32,
        'total': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListFilesCommand = de_ListFilesCommand;
const de_ListOrganisationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'organisations': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListOrganisationsCommand = de_ListOrganisationsCommand;
const de_ListPackagesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': smithy_client_1._json,
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListPackagesCommand = de_ListPackagesCommand;
const de_ListReleasesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': _ => de_GetReleaseResponseList(_, context),
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListReleasesCommand = de_ListReleasesCommand;
const de_PostLoginCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'organisations': smithy_client_1._json,
        'user_id': smithy_client_1.expectString,
        'user_token': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_PostLoginCommand = de_PostLoginCommand;
const de_RequestOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
        'organisation_name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_RequestOrganisationCommand = de_RequestOrganisationCommand;
const de_ServeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'package': smithy_client_1._json,
        'resources': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ServeReleaseCommand = de_ServeReleaseCommand;
const de_ServeReleaseV2Command = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'package': smithy_client_1._json,
        'resources': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ServeReleaseV2Command = de_ServeReleaseV2Command;
const de_UpdateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'change_reason': smithy_client_1.expectString,
        'description': _ => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'mandatory': smithy_client_1.expectBoolean,
        'position': smithy_client_1.expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UpdateDimensionCommand = de_UpdateDimensionCommand;
const de_UploadFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': _ => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UploadFileCommand = de_UploadFileCommand;
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await (0, core_1.parseJsonErrorBody)(output.body, context)
    };
    const errorCode = (0, core_1.loadRestJsonErrorCode)(output, parsedOutput.body);
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
const throwDefaultError = (0, smithy_client_1.withBaseException)(AirborneServiceException_1.AirborneServiceException);
const de_BadRequestErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.BadRequestError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_ForbiddenErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ForbiddenError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_NotFoundErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.NotFoundError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnauthorizedRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.Unauthorized({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const se_CreateReleaseRequestConfig = (input, context) => {
    return (0, smithy_client_1.take)(input, {
        'boot_timeout': [],
        'properties': _ => se_Document(_, context),
        'release_config_timeout': [],
    });
};
const se_CreateReleaseRequestPackage = (input, context) => {
    return (0, smithy_client_1.take)(input, {
        'important': smithy_client_1._json,
        'lazy': smithy_client_1._json,
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
    return (0, smithy_client_1.take)(output, {
        'tenant_info': (_) => de_Document(_, context),
    });
};
const de_CreateFileResponse = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': (_) => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
};
const de_DimensionList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_DimensionResponse(entry, context);
    });
    return retVal;
};
const de_DimensionResponse = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'change_reason': smithy_client_1.expectString,
        'description': (_) => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'mandatory': smithy_client_1.expectBoolean,
        'position': smithy_client_1.expectInt32,
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
    return (0, smithy_client_1.take)(output, {
        'boot_timeout': smithy_client_1.expectInt32,
        'properties': (_) => de_ConfigProperties(_, context),
        'release_config_timeout': smithy_client_1.expectInt32,
        'version': smithy_client_1.expectString,
    });
};
const de_GetReleaseResponse = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'config': (_) => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': (_) => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': (_) => de_ServePackage(_, context),
        'resources': smithy_client_1._json,
    });
};
const de_GetReleaseResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_GetReleaseResponse(entry, context);
    });
    return retVal;
};
const de_ServePackage = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'important': smithy_client_1._json,
        'index': smithy_client_1._json,
        'lazy': smithy_client_1._json,
        'name': smithy_client_1.expectString,
        'properties': (_) => de_Document(_, context),
        'version': smithy_client_1.expectString,
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
const collectBodyString = (streamBody, context) => (0, smithy_client_1.collectBody)(streamBody, context).then(body => context.utf8Encoder(body));
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
