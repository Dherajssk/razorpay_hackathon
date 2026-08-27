const { z } = require("zod");
const mongoose = require("mongoose");

const productService = require("../../services/productService");

const checkInventoryTool = {
  name: "check_inventory",

  description:
    "Check whether a specific product is currently available in stock. Returns availability and current stock level.",

  inputSchema: {
    productId: z
      .string()
      .describe("The MongoDB ObjectId of the product")
  },

  async execute(args) {
    try {
      console.error(
        "[MCP] check_inventory:",
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

      const inventoryStatus = {
        productId: product._id.toString(),
        name: product.name,
        available:
          product.stock > 0 && product.isActive,
        stock: product.stock,
        isActive: product.isActive
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              inventoryStatus,
              null,
              2
            )
          }
        ]
      };

    } catch (error) {
      console.error(
        "[MCP] check_inventory error:",
        error.message
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to check inventory",
              message: error.message
            })
          }
        ],
        isError: true
      };
    }
  }
};

module.exports = checkInventoryTool;