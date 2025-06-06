# AWS region where the resources will be created
region       = "us-east-1"

# Base name of S3 bucket (must be globally unique)
bucket_name  = "exemplo-devops"

# GitHub repository owner (user or organization)
github_owner = "SEU_GITHUB_USER_OU_ORG"

# Name of the GitHub repository where the code is located
github_repo  = "NOME_DO_REPOSITORIO"

GitHub access token (with permission for CodePipeline/CodeBuild)
github_token = "ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Branch that the pipeline should use (usually “main” or “master”)
branch       = "main"