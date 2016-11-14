const fs = require('fs');

function setToJson(set)
{
    return JSON.stringify([...set]);
}
function jsonToSet(jsonStr)
{
    return new Set(JSON.parse(jsonStr));
}

function SerializableSet()
{
    this.values = new Set();
}

SerializableSet.prototype.initializeFromArray = function (array)
{
    this.values = new Set(array);
};

SerializableSet.prototype.has = function (key)
{
    return this.values.has(key);
};

SerializableSet.prototype.clear = function () {
    this.values.clear();
};

SerializableSet.prototype.showValues = function (sep) {
    if (!sep)
        sep = ',';
    let result = '';
    this.forEach(function (elem) {
       result+=elem+sep;
    });
    return result.slice(0,-sep.length);
};

SerializableSet.prototype.add = function (elem)
{
    if (this.values.has(elem))
        return true;
    this.values.add(elem);
    return false;
};


SerializableSet.prototype.delete = function (elem)
{
    this.values.delete(elem);
};

SerializableSet.prototype.size = function ()
{
    return this.values.size;
};


SerializableSet.prototype.pickRandom = function ()
{
    const n = this.size();

    let k = Math.floor(Math.random() * n);
    let result = undefined;
    this.forEach(function (value)
    {
        if (k == 0)
        {
            result = value;
        }
        --k;
     });
    if (result)
        return result;
    else
        throw new Error('pickRandom algorithm exception (might be empty set)');
};

SerializableSet.prototype.save_to_file = function (filename)
{
    fs.writeFileSync(filename,setToJson(this.values));
};

SerializableSet.prototype.load_from_file = function (filename)
{
    var storage_str = fs.readFileSync(filename);
    this.values = jsonToSet(storage_str);
};

SerializableSet.prototype.forEach = function (callback)
{
    this.values.forEach(callback);
};

module.exports = SerializableSet;