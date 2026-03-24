from django.db import models


# =========================================
# PLANS
# =========================================

class Plan(models.Model):
    name = models.CharField(max_length=50)
    max_systems = models.IntegerField()
    max_tables_per_system = models.IntegerField(default=3)
    max_records_per_table = models.IntegerField(default=50000)
    max_fields_per_table = models.IntegerField(default=200)
    max_storage_mb = models.IntegerField(default=1024)

    def __str__(self):
        return self.name


# =========================================
# USERS
# =========================================

class User(models.Model):
    name = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(unique=True)
    password_hash = models.TextField()
    avatar_url = models.TextField(null=True, blank=True)
    role = models.CharField(max_length=20, default='user')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True)
    storage_used_bytes = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email


# =========================================
# SYSTEMS
# =========================================

class System(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    image_url = models.TextField(null=True, blank=True)
    security_mode = models.CharField(max_length=20, default='none')
    general_password = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SystemCollaborator(models.Model):
    system = models.ForeignKey(System, on_delete=models.CASCADE, related_name='collaborators')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    can_read = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ('system', 'user')

    def __str__(self):
        return f"{self.user.email} -> {self.system.name}"


# =========================================
# SYSTEM TABLES
# =========================================

class SystemTable(models.Model):
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('system', 'name')

    def __str__(self):
        return self.name


# =========================================
# SYSTEM FIELDS
# =========================================

class SystemField(models.Model):

    FIELD_TYPES = [
        ('text', 'Text'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('boolean', 'Boolean'),
        ('select', 'Select'),
        ('relation', 'Relation'),
    ]

    table = models.ForeignKey(SystemTable, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=FIELD_TYPES)
    required = models.BooleanField(default=False)
    order_index = models.IntegerField(default=0)
    related_table = models.ForeignKey(SystemTable, on_delete=models.SET_NULL, null=True, blank=True, related_name='related_fields')
    related_display_field = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='display_for_fields')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SystemFieldOption(models.Model):
    field = models.ForeignKey(SystemField, on_delete=models.CASCADE)
    value = models.CharField(max_length=100)

    def __str__(self):
        return self.value


# =========================================
# SYSTEM RECORDS
# =========================================

class SystemRecord(models.Model):
    table = models.ForeignKey(SystemTable, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


# =========================================
# RECORD VALUES
# =========================================

class SystemRecordValue(models.Model):
    record = models.ForeignKey(SystemRecord, on_delete=models.CASCADE)
    field = models.ForeignKey(SystemField, on_delete=models.CASCADE)
    value = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('record', 'field')


# =========================================
# RELATIONSHIPS
# =========================================

class SystemRelationship(models.Model):

    RELATION_TYPES = [
        ('one_to_one', 'One to One'),
        ('one_to_many', 'One to Many'),
        ('many_to_many', 'Many to Many'),
    ]

    system = models.ForeignKey(System, on_delete=models.CASCADE)

    from_table = models.ForeignKey(
        SystemTable,
        on_delete=models.CASCADE,
        related_name="relations_from_table"
    )

    from_field = models.ForeignKey(
        SystemField,
        on_delete=models.CASCADE,
        related_name="relations_from_field"
    )

    to_table = models.ForeignKey(
        SystemTable,
        on_delete=models.CASCADE,
        related_name="relations_to_table"
    )

    to_field = models.ForeignKey(
        SystemField,
        on_delete=models.CASCADE,
        related_name="relations_to_field"
    )

    relation_type = models.CharField(
        max_length=20,
        choices=RELATION_TYPES,
        default='many_to_many'
    )


# =========================================
# AUDIT LOGS
# =========================================

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    action = models.CharField(max_length=200)
    details = models.TextField(null=True, blank=True)
    ip = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SecurityAudit(models.Model):

    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS)
    event = models.CharField(max_length=255)
    details = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


# =========================================
# GLOBALS & REPORTS
# =========================================

class AppSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key


class UserReport(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    summary = models.TextField()
    screenshot_url = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title