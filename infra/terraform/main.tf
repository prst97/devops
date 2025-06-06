# Generates a random suffix
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# 1) S3 bucket to host the site (creates only the bucket)
resource "aws_s3_bucket" "site" {
  bucket = "${var.bucket_name}-${random_id.bucket_suffix.hex}"
  acl    = "public-read"

  versioning {
    enabled = true
  }

  tags = {
    Name        = "kanban-static-site"
    Environment = "production"
  }
}

# 2) Static website configuration in separate resource
resource "aws_s3_bucket_website_configuration" "site_cfg" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# 3) Disable public blocks for this bucket
resource "aws_s3_bucket_public_access_block" "site_block" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# 4) Public read policy (GET) for bucket objects
data "aws_iam_policy_document" "site_public_policy" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "site_policy" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_public_policy.json
}

# 5) S3 bucket for storing CodePipeline/CodeBuild artifacts
resource "aws_s3_bucket" "artifact" {
  bucket        = "${var.bucket_name}-artifact-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name        = "kanban-artifacts"
    Environment = "production"
  }
}

# 6) IAM Role for CodeBuild
data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild_role" {
  name               = "${var.github_repo}-codebuild-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

# 7) Minimum permissions for CodeBuild to work
data "aws_iam_policy_document" "codebuild_policy" {
  statement {
    sid    = "AllowS3AccessAndLogs"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:GetBucketLocation",
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "codebuild_role_policy" {
  role   = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codebuild_policy.json
}

# 8) CodeBuild project (uses SOURCE = “CODEPIPELINE”, variables defined as blocks)
resource "aws_codebuild_project" "build" {
  name         = "${var.github_repo}-build"
  service_role = aws_iam_role.codebuild_role.arn

  source {
    type      = "CODEPIPELINE"
    buildspec = <<EOT
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - npm ci
  build:
    commands:
      - npm run build
  post_build:
    commands:
      - aws s3 sync build/ s3://${aws_s3_bucket.site.id} --delete
EOT
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:5.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false

    environment_variable {
      name  = "BUCKET_NAME"
      value = aws_s3_bucket.site.id
    }
  }
}

# 9) IAM Role for CodePipeline
data "aws_iam_policy_document" "codepipeline_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline_role" {
  name               = "${var.github_repo}-codepipeline-role"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_assume.json
}

data "aws_iam_policy_document" "codepipeline_policy" {
  statement {
    sid    = "AllowCodeBuildStart"
    effect = "Allow"
    actions = [
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild"
    ]
    resources = [aws_codebuild_project.build.arn]
  }
  statement {
    sid    = "AllowS3Artifacts"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:GetBucketLocation"
    ]
    resources = [
      aws_s3_bucket.artifact.arn,
      "${aws_s3_bucket.artifact.arn}/*"
    ]
  }
  statement {
    sid    = "AllowPassRole"
    effect = "Allow"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.codebuild_role.arn
    ]
  }
}

resource "aws_iam_role_policy" "codepipeline_role_policy" {
  role   = aws_iam_role.codepipeline_role.id
  policy = data.aws_iam_policy_document.codepipeline_policy.json
}

# 10) CodePipeline
resource "aws_codepipeline" "pipeline" {
  name     = "${var.github_repo}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.artifact.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "GitHub_Source"
      category         = "Source"
      owner            = "ThirdParty"
      provider         = "GitHub"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        Owner      = var.github_owner
        Repo       = var.github_repo
        Branch     = var.branch
        OAuthToken = var.github_token
      }
    }
  }

  stage {
    name = "Build"

    action {
      name            = "CodeBuild_Build"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["source_output"]
      version         = "1"

      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }
}
