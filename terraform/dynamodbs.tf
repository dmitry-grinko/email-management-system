module "dynamodb_user_data" {
  source = "./modules/dynamodb"

  table_name = "${var.project-name}-user-data-table"
  tags       = local.tags
}
