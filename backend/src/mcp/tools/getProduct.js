const { z } = require("zod");
const mongoose = require("mongoose");

const productService = require("../../services/productService");

const getProductTool = {
  name: "get_product",

  description:
    "Retrieve complete details of a specific merchant product by its ID.",

  inputSchema: {
    productId: z
      .string()
      .describe("The MongoDB ObjectId of the product")
  },

  async execute(args) {
    try {
      console.error(
        "[MCP] get_product:",
        args.productId
      );

      if (!mongoose.Types.ObjectId.isValid(args.productId)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Invalid product ID format",
                productId: args.productId
              })
            }
          ],
          isError: true
        };
      }

      const product =
        await productService.getProductById(args.productId);

      if (!product) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Product not found",
                productId: args.productId
              })
            }
          ],
          isError: true
        };
      }

      const formattedProduct = {
        id: product._id.toString(),
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        stock: product.stock,
        specifications: product.specifications,
        rating: product.rating,
        deliveryDays: product.deliveryDays,
        description: product.description,
        isActive: product.isActive
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              formattedProduct,
              null,
              2
            )
          }
        ]
      };

    } catch (error) {
      console.error(
        "[MCP] get_product error:",
        error.message
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to retrieve product",
              message: error.message
            })
          }
        ],
        isError: true
      };
    }
  }
};

module.exports = getProductTool;