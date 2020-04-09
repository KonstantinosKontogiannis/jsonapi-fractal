import Context from './Context';
import DefaultTransformer from './DefaultTransformer';
import JsonApiError from './errors/JsonApiError';
import { whitelist, changeCase } from './utils';
export function transform() {
    return new Context(serializeContext);
}
export function serialize(data, type, options) {
    return transform()
        .withInput(data)
        .withTransformer(new DefaultTransformer(type, options.relationships || []))
        .withOptions(options)
        .serialize();
}
export function serializeContext(ctx) {
    if (!ctx.options) {
        ctx.options = {};
    }
    if (ctx.input === null) {
        return null;
    }
    const includedByType = {};
    const data = Array.isArray(ctx.input)
        ? ctx.input.map((e) => serializeEntity(e, ctx.transformer, ctx.options, includedByType))
        : serializeEntity(ctx.input, ctx.transformer, ctx.options, includedByType);
    const included = [];
    for (const type of Object.keys(includedByType)) {
        for (const id of Object.keys(includedByType[type])) {
            included.push(includedByType[type][id]);
        }
    }
    const result = { data };
    if (included.length > 0) {
        result.included = included;
    }
    return result;
}
function serializeEntity(entity, transformer, options, includedByType) {
    let attributes = Object.assign({}, transformer.transform(entity, options));
    const idKey = options.idKey || 'id';
    const id = attributes[idKey] || entity[idKey];
    if (!id) {
        throw new JsonApiError('Resource without id');
    }
    delete attributes[idKey];
    const relationships = {};
    for (const relation of transformer.relationships) {
        const ctx = transformer[relation](entity, options);
        relationships[relation] = {
            data: Array.isArray(ctx.input)
                ? ctx.input.map((e) => serializeRelation(e, ctx.transformer, options, ctx.included, includedByType))
                : serializeRelation(ctx.input, ctx.transformer, options, ctx.included, includedByType)
        };
    }
    if (options.fields && options.fields[transformer.type]) {
        const allowed = typeof (options.fields[transformer.type]) === 'string'
            ? options.fields[transformer.type].split(',')
            : options.fields[transformer.type].split(',');
        attributes = whitelist(attributes, allowed);
    }
    if (options.changeCase) {
        attributes = changeCase(attributes, options.changeCase);
    }
    const data = {
        id,
        type: transformer.type,
        attributes,
        relationships
    };
    if (Object.keys(data.relationships).length === 0) {
        delete data.relationships;
    }
    return data;
}
function serializeRelation(entity, transformer, options, included, includedByType) {
    if (!entity) {
        return null;
    }
    const idKey = options.idKey || 'id';
    const id = entity[idKey];
    if (!id) {
        throw new JsonApiError('Resource without id');
    }
    if (included) {
        if (!(transformer.type in includedByType)) {
            includedByType[transformer.type] = [];
        }
        if (!(id in includedByType[transformer.type])) {
            includedByType[transformer.type][id] = serializeEntity(entity, transformer, options, includedByType);
        }
    }
    return {
        type: transformer.type,
        id
    };
}