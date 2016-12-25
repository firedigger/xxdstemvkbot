const SerializableMap = require('./SerializableMap');

function RoleManager()
{
    this.Privileges = new SerializableMap();
}

RoleManager.prototype.initializeFromArray = function (admins)
{
	var self = this;
	admins.forEach(function (id)
	{
		self.setPrivileges(id,2);
	});
};

RoleManager.prototype.checkNullPrivilege = function (id)
{
    if (!this.Privileges.has(id+''))
        this.setPrivileges(id,0);
};

RoleManager.prototype.checkPrivileges = function (id, level)
{
    this.checkNullPrivilege(id);
    return this.getPrivileges(id) >= level;
};

RoleManager.prototype.setPrivileges = function (id, level)
{
    return this.Privileges.add(id+'',level);
};

RoleManager.prototype.getPrivileges = function (id)
{
    this.checkNullPrivilege(id);
    return this.Privileges.get(id+'');
};

RoleManager.prototype.op = function (id)
{
    var level = this.getPrivileges(id) + 1;
    this.setPrivileges(id,level);
    return level;
};

RoleManager.prototype.deop = function (id)
{
    var level = this.getPrivileges(id) - 1;
    this.setPrivileges(id,level);
    return level;
};

RoleManager.prototype.forEach = function (callback)
{
    this.Privileges.forEach(callback);
};

RoleManager.prototype.save_to_file = function (filename)
{
    this.Privileges.save_to_file(filename);
};

RoleManager.prototype.load_from_file = function (filename)
{
    this.Privileges.load_from_file(filename);
};


module.exports = RoleManager;

