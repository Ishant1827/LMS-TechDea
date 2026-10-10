// Makes a mis-scoped write loud instead of silent.
//
// `strictQuery: true` (config/db.js) drops filter keys that are not schema
// paths. For a read that is a sane defence — it is how a stray query operator
// from a request body is kept out of the query. For a *write* it fails in the
// dangerous direction, because the thing being dropped is the constraint:
//
//     Enrollment.deleteMany({ user: ids })   // the field is `student`
//                     ->  { }                // strictQuery removes it
//                     ->  every enrollment deleted, reported as success
//
// That is not hypothetical. It happened on 2026-09-18 and cost every enrollment
// in the database, with no error and a cheerful "10 deleted".
//
// R7 says a filter narrows a scope and never replaces it. Here the framework
// removes the scope on our behalf, so this restores the rule:
//
//   * a filter key that is not a schema path is a typo or a rename — throw
//   * a filter that is empty is not a scoped write at all — throw
//
// Reads are untouched. A deliberate whole-collection write says so explicitly:
//
//   Model.deleteMany({}).setOptions({ unscoped: true })

// Every query-level write. Document methods (doc.deleteOne(), doc.save()) are
// excluded below — they are scoped by the document's own _id and cannot lose it.
const GUARDED = [
  "deleteMany",
  "deleteOne",
  "updateMany",
  "updateOne",
  "replaceOne",
  "findOneAndDelete",
  "findOneAndUpdate",
  "findOneAndReplace",
];

// Keys that are logic rather than fields. The first three carry nested filters
// and are walked into; the rest are self-contained.
const BRANCHING = new Set(["$and", "$or", "$nor"]);
const ALLOWED_OPERATORS = new Set(["$expr", "$text", "$where", "$comment", "$jsonSchema"]);

function unknownKeys(schema, filter, found = []) {
  if (!filter || typeof filter !== "object") return found;

  for (const key of Object.keys(filter)) {
    if (BRANCHING.has(key)) {
      const branches = Array.isArray(filter[key]) ? filter[key] : [];
      for (const branch of branches) unknownKeys(schema, branch, found);
      continue;
    }
    if (ALLOWED_OPERATORS.has(key)) continue;
    if (key.startsWith("$")) {
      found.push(key); // an operator we have not vetted — say so rather than guess
      continue;
    }
    // pathType covers dotted paths and nested objects; "adhocOrUndefined" is
    // exactly what a typo looks like.
    if (schema.pathType(key) === "adhocOrUndefined") found.push(key);
  }
  return found;
}

function refuse(model, op, reason) {
  const err = new Error(
    `Refusing ${model}.${op}(): ${reason}. ` +
      `A scoped write that lost its scope removes every document in the collection. ` +
      `Check the field names against the schema, or pass .setOptions({ unscoped: true }) ` +
      `if the whole collection really is the target.`
  );
  err.status = 500; // never a client's fault, and never shown to one
  return err;
}

function guardSchema(schema) {
  if (schema.__safeWrites) return; // idempotent: applied via plugin and on reconnect
  schema.__safeWrites = true;

  for (const op of GUARDED) {
    // query: true / document: false matters — doc.deleteOne() is a different
    // hook with a different `this`, and it is already scoped by _id.
    schema.pre(op, { query: true, document: false }, function () {
      if (this.getOptions()?.unscoped === true) return;

      const model = this.model?.modelName || "Model";
      const filter = this.getFilter() || {};

      const bad = unknownKeys(this.schema, filter);
      if (bad.length) {
        throw refuse(model, op, `filter references unknown field(s): ${bad.join(", ")}`);
      }
      if (Object.keys(filter).length === 0) {
        throw refuse(model, op, "the filter is empty");
      }
    });
  }
}

// Registered before any model is compiled (see config/db.js), and re-applied to
// anything already registered so load order cannot quietly skip a model.
function installSafeWrites(mongoose) {
  mongoose.plugin(guardSchema);
  for (const name of mongoose.modelNames()) guardSchema(mongoose.model(name).schema);
}

module.exports = { installSafeWrites };
